import { Fragment, type ReactNode } from "react";
import { normalizeSubject } from "@/lib/subjects";

/**
 * Highlight matching tokens within `text`. Matching is done on the
 * normalized canonical form (case-insensitive, whitespace-collapsed) so
 * users see the same words that the subject filter/search matched on.
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
  const q = normalizeSubject(query);
  if (!src || !q) return <>{src}</>;

  // Build a set of tokens (full phrase + individual words) for matching.
  const tokens = Array.from(
    new Set(
      [q, ...q.split(/\s+/)]
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length); // longest first to avoid partial overlap

  if (tokens.length === 0) return <>{src}</>;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = src.split(re);

  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark key={i} className={className}>{part}</mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
