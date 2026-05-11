import { useMemo } from "react";
import { marked, Renderer } from "marked";
import DOMPurify from "dompurify";

const renderer = new Renderer();
const baseLink = renderer.link.bind(renderer);
renderer.link = (token) => {
  // Force target=_blank + rel — combined with main's setWindowOpenHandler,
  // clicks route to the user's default browser instead of navigating the renderer.
  const html = baseLink(token);
  return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
};
marked.setOptions({ gfm: true, breaks: true, renderer });

export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  const html = useMemo(() => {
    if (!source || !source.trim()) return "";
    const raw = marked.parse(source, { async: false }) as string;
    return DOMPurify.sanitize(raw, { ADD_ATTR: ["target", "rel"] });
  }, [source]);

  if (!html) return null;
  return (
    <div className={`prose prose-sm max-w-none ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}
