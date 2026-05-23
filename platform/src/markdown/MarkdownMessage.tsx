import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { MermaidBlock } from "./MermaidBlock";
import "./markdown.scss";

const components: Record<string, React.ComponentType<any>> = {
  code({ inline, className, children, ...props }: any) {
    const lang = (className ?? "").replace("language-", "");
    const code = String(children).replace(/\n$/, "");
    if (!inline && lang === "mermaid") return <MermaidBlock chart={code} />;
    // inline and block are styled via .md code / .md pre in markdown.scss
    return inline
      ? <code {...props}>{children}</code>
      : <pre><code {...props}>{children}</code></pre>;
  },
  table:  ({ children }: any) => <div className="table-wrapper"><table>{children}</table></div>,
  thead:  ({ children }: any) => <thead>{children}</thead>,
  th:     ({ children }: any) => <th>{children}</th>,
  tr:     ({ children }: any) => <tr>{children}</tr>,
  td:     ({ children }: any) => <td>{children}</td>,
  p:      ({ children }: any) => <p>{children}</p>,
  strong: ({ children }: any) => <strong>{children}</strong>,
  em:     ({ children }: any) => <em>{children}</em>,
  h1:     ({ children }: any) => <h1>{children}</h1>,
  h2:     ({ children }: any) => <h2>{children}</h2>,
  h3:     ({ children }: any) => <h3>{children}</h3>,
  ul:     ({ children }: any) => <ul>{children}</ul>,
  ol:     ({ children }: any) => <ol>{children}</ol>,
  li:     ({ children }: any) => <li>{children}</li>,
  hr:     ()                  => <hr />,
  blockquote: ({ children }: any) => <blockquote>{children}</blockquote>,
  a: ({ children, href }: any) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}