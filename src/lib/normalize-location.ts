/**
 * Normalize a free-text location string (university or country) so that
 * different spellings collide on the same canonical value for Campus filtering.
 *
 * - Trims surrounding whitespace
 * - Collapses inner whitespace runs to a single space
 * - Title-cases each word, while preserving small connector words (of, the,
 *   and, at, in, on, for) in lowercase when they aren't the first word
 * - Upper-cases short tokens that look like acronyms (MIT, UCT, NUS, USA…)
 */
export function normalizeLocation(input: string | null | undefined): string | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const SMALL = new Set(["of", "the", "and", "at", "in", "on", "for", "de", "da", "do"]);

  return cleaned
    .split(" ")
    .map((raw, i) => {
      const word = raw.toLowerCase();
      // Acronym-ish: 2–4 chars, no vowels OR fully uppercase originally
      if (
        (raw.length <= 4 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) ||
        (word.length <= 4 && !/[aeiouy]/.test(word))
      ) {
        return raw.toUpperCase();
      }
      if (i > 0 && SMALL.has(word)) return word;
      // Handle hyphenated words (e.g. Aix-en-Provence)
      return word
        .split("-")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join("-");
    })
    .join(" ");
}
