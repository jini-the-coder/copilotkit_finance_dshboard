import os
import json
import asyncio
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import httpx

# ── Load environment variables ──────────────────────────────────
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ── Model strategy ──────────────────────────────────────────────
# Pinned stable models in fallback order. The endpoint tries the
# first one; if it fails with a retryable error (5xx, 429, 503,
# timeout, model-not-found), it automatically falls back to the
# next one. This gives near-zero downtime even when Google rotates
# preview models or temporarily overloads a tier.
#
# Why these in this order:
#   1. gemini-2.5-flash       — GA stable, fast, cheap, well-supported
#   2. gemini-2.5-flash-lite  — same family, even cheaper, almost
#                               identical reliability
#   3. gemini-2.0-flash-001   — older but battle-tested; ultimate
#                               fallback while it remains active
#
# DO NOT use "-latest" aliases in production. They hot-swap to
# preview builds and cause sporadic failures.
MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-001",
]

# Per-attempt retry config
MAX_RETRIES_PER_MODEL = 2          # in-model retries on transient errors
RETRY_BASE_DELAY      = 0.8        # seconds; exponential backoff
HTTP_TIMEOUT          = 45.0       # seconds; tighter than 60 so frontend doesn't stall

GEMINI_URL_TMPL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent"
)

# Errors we retry: server errors, rate limits, request timeouts.
RETRYABLE_HTTP = {429, 500, 502, 503, 504}

if not GEMINI_API_KEY:
    print("⚠️  WARNING: GEMINI_API_KEY not found in .env file")
else:
    print(f"🔑 Gemini key loaded: {GEMINI_API_KEY[:10]}...")
print(f"🤖 Model chain: {' → '.join(MODEL_CHAIN)}")

# ── FastAPI app setup ───────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: call Gemini with retry + fallback chain ────────────
class GeminiError(Exception):
    """Raised when all models in the chain have failed."""
    def __init__(self, message: str, last_status: Optional[int] = None):
        super().__init__(message)
        self.last_status = last_status


async def _call_one_model(
    client: httpx.AsyncClient,
    model: str,
    contents: list,
) -> str:
    """Call a single model with bounded retries. Returns reply text
    on success, raises GeminiError on permanent failure."""
    url = GEMINI_URL_TMPL.format(model=model)
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature":     0.7,
            "maxOutputTokens": 2048,
        },
    }

    last_status: Optional[int] = None
    last_err: Optional[str] = None

    for attempt in range(MAX_RETRIES_PER_MODEL + 1):
        try:
            response = await client.post(
                f"{url}?key={GEMINI_API_KEY}",
                json=payload,
            )
            last_status = response.status_code

            # 404 / 400 = model gone or bad request → don't retry this
            # model, but DO let the caller fall back to the next one.
            if response.status_code in (400, 404):
                try:
                    err_body = response.json().get("error", {}).get("message", "")
                except Exception:
                    err_body = response.text[:200]
                raise GeminiError(
                    f"{model} returned {response.status_code}: {err_body}",
                    last_status=response.status_code,
                )

            # Transient errors → retry this same model with backoff
            if response.status_code in RETRYABLE_HTTP:
                last_err = f"HTTP {response.status_code}"
                if attempt < MAX_RETRIES_PER_MODEL:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    print(f"⏳ {model} → {last_err}, retrying in {delay:.1f}s "
                          f"(attempt {attempt + 1}/{MAX_RETRIES_PER_MODEL})")
                    await asyncio.sleep(delay)
                    continue
                raise GeminiError(
                    f"{model} failed after retries: {last_err}",
                    last_status=response.status_code,
                )

            # Any other non-2xx → treat as permanent for this model
            if response.status_code >= 400:
                raise GeminiError(
                    f"{model} returned {response.status_code}",
                    last_status=response.status_code,
                )

            result = response.json()

            # Gemini sometimes responds 200 with an error in the body
            if "error" in result:
                msg = result["error"].get("message", "Unknown Gemini error")
                raise GeminiError(f"{model} body error: {msg}",
                                  last_status=response.status_code)

            # Extract text from candidates → content → parts
            try:
                return result["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, TypeError):
                # Could be a blocked response, empty candidates, etc.
                finish_reason = (
                    result.get("candidates", [{}])[0].get("finishReason", "UNKNOWN")
                )
                if finish_reason == "SAFETY":
                    # Don't retry / fall back — safety block is deterministic
                    return ("I can't respond to that request because it was "
                            "flagged by safety filters. Please rephrase.")
                raise GeminiError(
                    f"{model} returned unexpected response shape "
                    f"(finish_reason={finish_reason})",
                    last_status=response.status_code,
                )

        except httpx.TimeoutException:
            last_err = "timeout"
            if attempt < MAX_RETRIES_PER_MODEL:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                print(f"⏳ {model} → timeout, retrying in {delay:.1f}s")
                await asyncio.sleep(delay)
                continue
            raise GeminiError(f"{model} timed out after retries")

        except httpx.RequestError as e:
            # Network/connection errors — retry
            last_err = f"network: {type(e).__name__}"
            if attempt < MAX_RETRIES_PER_MODEL:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                print(f"⏳ {model} → {last_err}, retrying in {delay:.1f}s")
                await asyncio.sleep(delay)
                continue
            raise GeminiError(f"{model} network failed: {last_err}")

    # Defensive: should be unreachable
    raise GeminiError(f"{model} exhausted retries: {last_err}",
                      last_status=last_status)


async def call_gemini(contents: list) -> str:
    """Call Gemini with model fallback. Always returns text, but may
    raise GeminiError if every model in the chain fails."""
    last_exc: Optional[GeminiError] = None

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        for i, model in enumerate(MODEL_CHAIN):
            try:
                text = await _call_one_model(client, model, contents)
                if i > 0:
                    print(f"✅ Recovered via fallback model: {model}")
                return text
            except GeminiError as e:
                print(f"❌ {model} failed: {e}")
                last_exc = e
                # Try the next model in the chain
                continue

    raise last_exc or GeminiError("All Gemini models failed")


# ── CopilotKit compatible endpoint ─────────────────────────────
@app.post("/api/copilotkit/")
async def copilotkit(request: Request):
    try:
        body = await request.json()
        print("📨 CopilotKit request received")

        # Extract messages from CopilotKit GraphQL format
        messages = []
        variables = body.get("variables", {})
        data = variables.get("data", {})
        msgs = data.get("messages", [])

        for msg in msgs:
            role = msg.get("role", "user")
            if isinstance(msg.get("content"), list):
                content = " ".join(
                    c.get("text", "") for c in msg["content"]
                    if isinstance(c, dict)
                )
            else:
                content = str(msg.get("content", ""))

            if content.strip():
                messages.append({
                    "role":  "user" if role == "user" else "model",
                    "parts": [{"text": content}],
                })

        print(f"📝 Messages extracted: {len(messages)}")

        if not messages:
            messages = [{"role": "user", "parts": [{"text": "Hello"}]}]

        try:
            ai_text = await call_gemini(messages)
            print(f"✅ AI response: {ai_text[:100]}")
        except GeminiError as e:
            print(f"❌ All models failed: {e}")
            ai_text = (
                "I'm having trouble connecting to the AI service right now. "
                "Please try again in a moment."
            )

        async def generate():
            yield "data: " + json.dumps({
                "data": {
                    "generateCopilotResponse": {
                        "threadId": "thread-1",
                        "runId":    "run-1",
                        "status": {
                            "code":       "MESSAGE_LIMIT_REACHED",
                            "__typename": "BaseResponseStatus",
                        },
                        "messages": [
                            {
                                "__typename": "TextMessageOutput",
                                "id":         "msg-1",
                                "role":       "assistant",
                                "content":    [{"type": "text", "text": ai_text}],
                            }
                        ],
                    }
                }
            }) + "\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control":     "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        print("❌ Server error:", str(e))
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


# ── Simple chat endpoint (SSE) ──────────────────────────────────
@app.post("/api/chat")
async def chat(request: Request):
    data = await request.json()
    messages = data.get("messages", [])

    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    async def generate():
        try:
            text = await call_gemini(contents)
            yield f"data: {json.dumps({'content': text})}\n\n"
        except GeminiError as e:
            # User-friendly message; technical details go to server logs
            print(f"❌ /api/chat all models failed: {e}")
            friendly = (
                "I'm temporarily unable to reach the AI service. "
                "Please try again in a few seconds."
            )
            yield f"data: {json.dumps({'content': friendly})}\n\n"
        except Exception as e:
            print(f"❌ /api/chat unexpected error: {e}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'content': 'Server error. Please retry.'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Health check ────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":      "ok",
        "model_chain": MODEL_CHAIN,
    }


# ── Entry point ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)