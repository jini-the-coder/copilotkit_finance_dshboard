import React, { useState } from "react";
import { SalesMetrics } from "../types";
import { useChat } from "../hooks/useChat";
import { QUICK_PROMPTS } from "../constants/metrics";
import { MarkdownMessage } from "../markdown/MarkdownMessage";
import "./chatbot.scss";

interface ChatBotProps {
  metrics:       SalesMetrics;
  onActionText:  (text: string, isFinal: boolean) => void;
  isOpen:        boolean;
  onOpenChange:  (open: boolean) => void;
}

export function ChatBot({ metrics, onActionText, isOpen, onOpenChange }: ChatBotProps) {
  const { messages, input, setInput, loading, sendMessage, bottomRef } =
    useChat({ metrics, onActionText });

  const [promptsOpen, setPromptsOpen] = useState(false);

  // ── Closed state: floating reopen button ───────────────────────────────
  if (!isOpen) {
    return (
      <button
        className="chatbot-toggle"
        onClick={() => onOpenChange(true)}
        title="Open AI Advisor"
      >
        💬
      </button>
    );
  }

  return (
    <div className="chatbot">

      {/* ── Header ── */}
      <div className="chatbot__header">
        <div className="chatbot__avatar">🤖</div>
        <div className="chatbot__header-info">
          <div className="chatbot__header-title">AI ADVISOR</div>
        </div>
        <button
          className="chatbot__close-btn"
          onClick={() => onOpenChange(false)}
          title="Close chat"
        >
          ✕
        </button>
      </div>

      {/* ── Quick Prompts (collapsible) ── */}
      <div className="chatbot__prompts">
        <div
          className="chatbot__prompts-header"
          onClick={() => setPromptsOpen(prev => !prev)}
        >
          <span className="chatbot__prompts-label">QUICK SCENARIOS</span>
          <span className={`chatbot__prompts-chevron${promptsOpen ? " chatbot__prompts-chevron--open" : ""}`}>
            ▼
          </span>
        </div>

        <div className={`chatbot__prompts-body${promptsOpen ? "" : " chatbot__prompts-body--collapsed"}`}>
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              className="prompt-chip"
              onClick={() => {
                sendMessage(p);
                setPromptsOpen(false);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="chatbot__messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message message--${msg.role}`}>
            <div className="message__role">
              {msg.role === "user" ? "YOU" : "AI ADVISOR"}
            </div>
            <div className={`message__bubble message__bubble--${msg.role}`}>
              {msg.isLoading ? (
                <span className="message__loading">● ● ●</span>
              ) : msg.role === "assistant" ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="chatbot__input-area">
        <div className="chatbot__input-row">
          <input
            className="chatbot__input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask about deposits, loans, scenarios..."
            disabled={loading}
          />
          <button
            className="chatbot__send-btn"
            onClick={() => sendMessage()}
            disabled={loading}
          >
            {loading ? "⏳" : "➤"}
          </button>
        </div>
      </div>

    </div>
  );
}