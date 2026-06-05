import { Fragment, type ReactNode } from "react";
import { normalizeSubject } from "@/lib/subjects";

export interface HighlightRange {
  start: number;
  end: number; // exclusive
}

/**
 * Compute non-overlapping match ranges for `query` tokens inside `text`.
 * Matching is case-insensitive against the raw source string. The query is
 * normalized first (whitespace collapsed, trimmed) so the same tokens that
 * drive subject filtering also drive highlighting.
 *
 * Overlap resolution is deterministic: scan left-to-right; at each cursor,
 * pick the LONGEST token that matches at the earliest position >= cursor.
 * That guarantees longer phrases win over their sub-words and the same input
 * always yields the same ranges.
 */
export function computeHighlightRanges(text: string, query: string): HighlightRange[] {
  if (!text || !query) return [];
  const q = normalizeSubject(query);
  if (!q) return [];

  const tokens = Array.from(
    new Set(
      [q, ...q.split(/\s+/)]
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length);

  if (tokens.length === 0) return [];

  const lower = text.toLowerCase();
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  const ranges: HighlightRange[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let bestStart = -1;
    let bestLen = 0;
    for (const tok of lowerTokens) {
      const idx = lower.indexOf(tok, cursor);
      if (idx === -1) continue;
      // Prefer earlier match; if equal start, prefer longer token.
      if (bestStart === -1 || idx < bestStart || (idx === bestStart && tok.length > bestLen)) {
        bestStart = idx;
        bestLen = tok.length;
      }
    }
    if (bestStart === -1) break;
    ranges.push({ start: bestStart, end: bestStart + bestLen });
    cursor = bestStart + bestLen;
  }
  return ranges;
}

/**
 * Highlight matching tokens within `text` using deterministic match indices.
 * Overlapping/duplicate tokens are resolved by `computeHighlightRanges`.
 */
export function Highlight({
  text,
  query,
  className = "bg-yellow-200/70 dark:bg-yellow-500/30 text-foreground rounded px-0.5",
}: {
  text: string | null | undefined;
  query: string;
  className?: string;
}): ReactNode {
  const src = text ?? "";
  const ranges = computeHighlightRanges(src, query);
  if (ranges.length === 0) return <>{src}</>;

  const nodes: ReactNode[] = [];
  let pos = 0;
  ranges.forEach((r, i) => {
    if (r.start > pos) nodes.push(<Fragment key={`t-${i}`}>{src.slice(pos, r.start)}</Fragment>);
    nodes.push(
      <mark key={`m-${i}`} className={className}>
        {src.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  });
  if (pos < src.length) nodes.push(<Fragment key="tail">{src.slice(pos)}</Fragment>);
  return <>{nodes}</>;
}
