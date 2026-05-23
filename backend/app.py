import os
import json

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import httpx

# ── Load environment variables ──────────────────────────────────
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-flash-latest"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

if not GEMINI_API_KEY:
    print("⚠️  WARNING: GEMINI_API_KEY not found in .env file")
else:
    print(f"🔑 Gemini key loaded: {GEMINI_API_KEY[:10]}...")

# ── FastAPI app setup ───────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: call Gemini ─────────────────────────────────────────
async def call_gemini(contents: list) -> str:
    """Send a request to Gemini and return the AI's reply text."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json={
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 2048,
                },
            },
        )
        result = response.json()

        if "error" in result:
            print("❌ Gemini error:", result["error"])
            return f"Error: {result['error'].get('message', 'Unknown error')}"

        try:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            print("❌ Unexpected Gemini response:", result)
            return "Error: Unexpected response from Gemini."


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
                    "role": "user" if role == "user" else "model",
                    "parts": [{"text": content}],
                })

        print(f"📝 Messages extracted: {len(messages)}")

        if not messages:
            messages = [{"role": "user", "parts": [{"text": "Hello"}]}]

        ai_text = await call_gemini(messages)
        print(f"✅ AI response: {ai_text[:100]}")

        # Return in CopilotKit streaming format
        async def generate():
            yield "data: " + json.dumps({
                "data": {
                    "generateCopilotResponse": {
                        "threadId": "thread-1",
                        "runId": "run-1",
                        "status": {
                            "code": "MESSAGE_LIMIT_REACHED",
                            "__typename": "BaseResponseStatus",
                        },
                        "messages": [
                            {
                                "__typename": "TextMessageOutput",
                                "id": "msg-1",
                                "role": "assistant",
                                "content": [{"type": "text", "text": ai_text}],
                            }
                        ],
                    }
                }
            }) + "\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
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
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'content': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Health check ────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model": GEMINI_MODEL}


# ── Entry point ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)