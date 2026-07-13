"use client";

import { useMemo } from "react";
import katex from "katex";

// -----------------------------------------------------------------------------
// Renders a string that mixes plain text with LaTeX delimited by \( \) (inline)
// and \[ \] (display). Also tolerates $...$ and $$...$$ as a convenience.
// Non-math text is HTML-escaped; math is rendered with KaTeX.
// -----------------------------------------------------------------------------

interface Segment {
  type: "text" | "inline" | "display";
  value: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}

function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  // Ordered so the two-char delimiters are tried before single $.
  const pattern =
    /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]*?)\$/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "display", value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "inline", value: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "display", value: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "inline", value: match[4] });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < input.length) {
    segments.push({ type: "text", value: input.slice(lastIndex) });
  }
  return segments;
}

function renderToHtml(input: string): string {
  const segments = parseSegments(input);
  return segments
    .map((seg) => {
      if (seg.type === "text") {
        return escapeHtml(seg.value);
      }
      try {
        return katex.renderToString(seg.value, {
          displayMode: seg.type === "display",
          throwOnError: false,
        });
      } catch {
        // Fall back to showing the raw (escaped) LaTeX if KaTeX chokes.
        return escapeHtml(seg.value);
      }
    })
    .join("");
}

export default function MathText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const html = useMemo(() => renderToHtml(children ?? ""), [children]);
  return (
    <span
      className={className}
      // Content is HTML-escaped above; only KaTeX-generated markup is injected.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
