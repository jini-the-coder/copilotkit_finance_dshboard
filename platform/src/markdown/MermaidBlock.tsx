import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { COLORS } from "../constants/theme";
import "./markdown.scss";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  themeVariables: {
    primaryColor:    COLORS.primary,
    primaryTextColor:"#111",
    lineColor:       "#555",
  },
});

interface MermaidBlockProps {
  chart: string;
}

export function MermaidBlock({ chart }: MermaidBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id  = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!ref.current) return;
    mermaid
      .render(id.current, chart.trim())
      .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg; })
      .catch(err  => { if (ref.current) ref.current.innerHTML = `<pre style="color:red;font-size:11px;padding:8px">${err}</pre>`; });
  }, [chart]);

  return <div ref={ref} className="mermaid-block" />;
}