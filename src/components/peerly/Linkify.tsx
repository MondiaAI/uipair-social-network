import React from "react";

// Matches http(s)://, www. and bare domain.tld URLs.
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;!?)\]'"`])|(\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<]*)?)/gi;

function normalizeHref(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/\//, "")}`;
}

/** Renders text with auto-detected URLs converted into clickable links. */
export function Linkify({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const href = normalizeHref(raw);
    parts.push(
      <a
        key={`${start}-${raw}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 break-all hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>,
    );
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <span className={className}>{parts}</span>;
}
