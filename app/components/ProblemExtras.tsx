"use client";

import type { Option } from "../lib/types";
import MathText from "./MathText";

// -----------------------------------------------------------------------------
// Shared renderers for the richer per-problem shape: multiple-choice options and
// transcribed markdown tables. Used by both the problem list and the tutor view.
// -----------------------------------------------------------------------------

/**
 * Pick a single renderable form for an option. Extraction often fills BOTH
 * `text` and `latex` with the same content (e.g. "2x + 3y"), so showing both
 * duplicates it. Prefer the plain text (it keeps readable spacing like
 * "S 25° E") and fall back to the LaTeX only when there's no text. Any math
 * delimiters inside the text still render via MathText.
 */
function optionContent(option: Option): string {
  const text = option.text?.trim() ?? "";
  const latex = option.latex?.trim() ?? "";
  return text || latex;
}

/** Render a problem's A/B/C/D options as a read-only list (math via KaTeX). */
export function OptionsList({ options }: { options: Option[] }) {
  if (!options || options.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {options.map((option, i) => (
        <li key={`${option.letter}-${i}`} className="flex gap-2 text-text">
          <span className="font-semibold text-text-muted">
            {option.letter || String.fromCharCode(65 + i)})
          </span>
          <MathText>{optionContent(option)}</MathText>
        </li>
      ))}
    </ul>
  );
}

/**
 * Parse a GitHub-flavored markdown table into rows of cells. Returns null if the
 * input doesn't look like a table so callers can fall back to plain rendering.
 */
function parseMarkdownTable(
  markdown: string
): { header: string[]; rows: string[][] } | null {
  const lines = markdown
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  const splitRow = (line: string): string[] => {
    let cells = line.split("|");
    // Drop the empty cells created by leading/trailing pipes.
    if (cells.length && cells[0].trim() === "") cells = cells.slice(1);
    if (cells.length && cells[cells.length - 1].trim() === "") {
      cells = cells.slice(0, -1);
    }
    return cells.map((c) => c.trim());
  };

  const isSeparator = (line: string): boolean =>
    /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line);

  // The second line of a markdown table is the --- separator.
  if (!isSeparator(lines[1])) return null;

  const header = splitRow(lines[0]);
  const rows = lines.slice(2).map(splitRow);
  return { header, rows };
}

/** Render a transcribed markdown table, falling back to preformatted text. */
export function TableBlock({ table }: { table: string }) {
  if (!table || !table.trim()) return null;
  const parsed = parseMarkdownTable(table);

  if (!parsed) {
    return (
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-bg p-3 text-sm">
        {table}
      </pre>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {parsed.header.map((cell, i) => (
              <th
                key={i}
                className="border border-border bg-bg px-3 py-2 text-left font-semibold"
              >
                <MathText>{cell}</MathText>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-border px-3 py-2">
                  <MathText>{cell}</MathText>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
