import { useState, useRef, useEffect, useCallback } from "react";
import { Message, SalesMetrics } from "../types";
import { buildSystemPrompt } from "../utils/systemPrompt";

const API_URL = "http://localhost:5000/api/chat";

const WELCOME: Message = {
  role: "assistant",
  content: `Welcome to **AI Advisor**.

Try asking:
- **"How can we grow deposits 10%?"**
- **"What if we open 25 new branches?"**
- **"Lift digital adoption to 85%"**
- **"Simulate a strong quarter"**
- **"Reset to defaults"**`,
};

interface UseChatOptions {
  metrics:      SalesMetrics;
  onActionText: (text: string, isFinal: boolean) => void;
}

export function useChat({ metrics, onActionText }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const history: Message[] = [...messages, { role: "user", content: msg }];

    // Start with isLoading=true — shows "● ● ●" until actual text arrives.
    // This covers the gap where ACTION fires but no display text exists yet.
    setMessages([...history, { role: "assistant", content: "", isLoading: true }]);
    setInput("");
    setLoading(true);

    const payload = [
      { role: "user", content: buildSystemPrompt(metrics) },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ];

    try {
      const res = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: payload }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      let lineBuffer      = "";
      let full            = "";
      let actionFiredOnce = false;

      /**
       * Strip ACTION tags from what the user sees:
       *  - Complete  [ACTION:...] → removed
       *  - Partial   [ACTION:...  (no closing ] yet) → also removed
       */
      const getDisplay = (raw: string): string =>
        raw
          .replace(/\[ACTION:[\s\S]*?\]/g, "")
          .replace(/\[ACTION:[\s\S]*$/,    "")
          .trim();

      // ── Main read loop ──────────────────────────────────────────────────
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw   = lineBuffer + decoder.decode(value, { stream: true });
        const lines = raw.split("\n");
        lineBuffer  = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;

          try {
            const d = JSON.parse(line.slice(6));
            if (typeof d.content === "string" && d.content) {
              full += d.content;

              // Fire action as soon as the closing ] arrives mid-stream
              if (!actionFiredOnce && /\[ACTION:[\s\S]*?\]/.test(full)) {
                console.log("⚡ ACTION detected mid-stream — firing early");
                console.log("📨 Raw (first 300):", full.slice(0, 300));
                onActionText(full, false);
                actionFiredOnce = true;
              }

              const display = getDisplay(full);

              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  role:      "assistant",
                  content:   display,
                  // Keep spinner visible until real text arrives.
                  // Once display has content, dots disappear and text streams in.
                  isLoading: display.length === 0,
                };
                return next;
              });
            }
          } catch {
            // Partial / malformed JSON — safe to skip
          }
        }
      }

      // ── Flush decoder buffer ────────────────────────────────────────────
      const tail = decoder.decode();
      if (tail) {
        const tailLines = (lineBuffer + tail).split("\n");
        for (const line of tailLines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (typeof d.content === "string" && d.content) full += d.content;
          } catch { /* ignore */ }
        }
      }

      console.log("✅ Stream complete. Full length:", full.length);

      // Always fire post-stream with complete text (isFinal=true).
      // useSalesMetrics deduplicates so the action won't run twice.
      onActionText(full, true);

      // Final clean render — isLoading always false once stream is done
      const finalDisplay = getDisplay(full);
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role:      "assistant",
          content:   finalDisplay,
          isLoading: false,
        };
        return next;
      });

    } catch (err) {
      console.error("[useChat] stream error:", err);
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role:      "assistant",
          content:   "❌ Connection error. Check backend on port 5000.",
          isLoading: false,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, metrics, onActionText]);

  return { messages, input, setInput, loading, sendMessage, bottomRef };
}