import React, { useState, useCallback, useRef } from "react";
import { Dashboard }       from "./dashboard/Dashboard";
import { ChatBot }         from "../src/chatbot/Chatbot";
import { useSalesMetrics } from "./hooks/useSalesMetrics";
import "./styles/global.scss";
import "./App.scss";

const CHATBOT_MIN_WIDTH     = 320;
const CHATBOT_MAX_WIDTH     = 900;
const CHATBOT_DEFAULT_WIDTH = 400;

export default function App() {
  const { metrics, changedKeys, applyEmbeddedActions, resetMetrics } = useSalesMetrics();

  const [chatWidth, setChatWidth]   = useState(CHATBOT_DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);  // ⬅ lifted from ChatBot
  const startXRef                   = useRef(0);
  const startWidthRef               = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current     = e.clientX;
    startWidthRef.current = chatWidth;
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const delta    = startXRef.current - ev.clientX;
      const newWidth = Math.min(
        CHATBOT_MAX_WIDTH,
        Math.max(CHATBOT_MIN_WIDTH, startWidthRef.current + delta),
      );
      setChatWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
  }, [chatWidth]);

  return (
    <div className={`app-layout${isDragging ? " app-layout--dragging" : ""}`}>

      {/* Dashboard */}
      <div className="app-layout__dashboard">
        <Dashboard
          metrics={metrics}
          changedKeys={changedKeys}
          onReset={resetMetrics}
        />
      </div>

      {/* Drag handle — hidden when chat is closed */}
      <div
        className={
          `app-layout__handle` +
          (isDragging   ? " app-layout__handle--active" : "") +
          (!isChatOpen  ? " app-layout__handle--hidden" : "")
        }
        onMouseDown={onMouseDown}
        title="Drag to resize"
      >
        <div className="app-layout__handle-line" />
        <div className="app-layout__handle-dots">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="app-layout__handle-dot" />
          ))}
        </div>
      </div>

      {/* ChatBot — collapses to 0 width when closed, freeing space for dashboard */}
      <div
        className={`app-layout__chat${!isChatOpen ? " app-layout__chat--collapsed" : ""}`}
        style={{ "--chat-width": `${chatWidth}px` } as React.CSSProperties}
      >
        <ChatBot
          metrics={metrics}
          onActionText={applyEmbeddedActions}
          isOpen={isChatOpen}
          onOpenChange={setIsChatOpen}
        />
      </div>

    </div>
  );
}