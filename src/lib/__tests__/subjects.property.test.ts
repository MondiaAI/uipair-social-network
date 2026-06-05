import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  normalizeSubject,
  canonicalSubject,
  addCustomSubject,
  SUBJECTS,
} from "@/lib/subjects";
import { computeHighlightRanges } from "@/components/peerly/Highlight";

// In-memory localStorage shim for vitest's node env.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  get length() { return this.m.size; }
}
const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
if (typeof g.window === "undefined") g.window = g;
if (typeof g.localStorage === "undefined") g.localStorage = new MemStorage();
const w = g.window as { localStorage?: unknown; dispatchEvent?: unknown };
if (typeof w.localStorage === "undefined") w.localStorage = g.localStorage;
if (typeof w.dispatchEvent === "undefined") w.dispatchEvent = () => true;

// ---------------- Arbitraries ----------------

// Visible-text arbitrary that biases toward characters we actually expect in
// subject names: ASCII letters, common diacritics, digits, spaces, and
// punctuation. Excludes control characters that would never appear in real input.
const SUBJECT_CHAR = fc.oneof(
  { weight: 6, arbitrary: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz") },
  { weight: 4, arbitrary: fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ") },
  { weight: 3, arbitrary: fc.constantFrom(..." \t\n") },
  { weight: 2, arbitrary: fc.constantFrom(..."0123456789") },
  { weight: 2, arbitrary: fc.constantFrom(..."-/&+.!?,()[]") },
  { weight: 2, arbitrary: fc.constantFrom(..."àáâäãåéèêëíìîïóòôöõúùûüýñçÀÁÂÄÉÈÊËÍÎÏÓÔÖÚÛÜÑÇ") },
);

const SUBJECT_TEXT = fc.string({ unit: SUBJECT_CHAR, minLength: 0, maxLength: 40 });
const NONEMPTY_SUBJECT_TEXT = SUBJECT_TEXT.filter((s: string) => s.replace(/\s+/g, "").length > 0);

// ---------------- normalizeSubject invariants ----------------

describe("property: normalizeSubject invariants", () => {
  it("never throws and is idempotent for any input", () => {
    fc.assert(
      fc.property(SUBJECT_TEXT, (raw) => {
        const a = normalizeSubject(raw);
        const b = normalizeSubject(a);
        expect(b).toBe(a);
      }),
      { numRuns: 300 },
    );
  });

  it("collapses whitespace: no leading, trailing, or double spaces", () => {
    fc.assert(
      fc.property(SUBJECT_TEXT, (raw) => {
        const n = normalizeSubject(raw);
        expect(n.startsWith(" ")).toBe(false);
        expect(n.endsWith(" ")).toBe(false);
        expect(/\s{2,}/.test(n)).toBe(false);
        // No tabs or newlines should survive.
        expect(/[\t\n\r]/.test(n)).toBe(false);
      }),
      { numRuns: 300 },
    );
  });

  it("is whitespace-invariant: extra surrounding/internal spaces don't change canonical form", () => {
    fc.assert(
      fc.property(NONEMPTY_SUBJECT_TEXT, fc.nat({ max: 5 }), fc.nat({ max: 5 }), (raw, pad, gaps) => {
        const padding = " ".repeat(pad);
        const inflated = padding + raw.replace(/\s/g, " ".repeat(gaps + 1)) + padding;
        expect(normalizeSubject(inflated)).toBe(normalizeSubject(raw));
      }),
      { numRuns: 200 },
    );
  });

  it("is case-insensitive at the canonical layer: any casing normalizes the same way as its lowercase", () => {
    // Compare canonical-of-input vs canonical-of-lowercased-input. They must
    // resolve to the same canonical subject because matching is case-insensitive.
    fc.assert(
      fc.property(NONEMPTY_SUBJECT_TEXT, (raw) => {
        const c1 = canonicalSubject(raw);
        const c2 = canonicalSubject(raw.toLowerCase());
        expect(c1.toLowerCase()).toBe(c2.toLowerCase());
      }),
      { numRuns: 300 },
    );
  });
});

// ---------------- canonicalSubject matching invariants ----------------

describe("property: canonicalSubject matching", () => {
  it("recognises every built-in subject regardless of casing and surrounding spaces", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(SUBJECTS as readonly string[])),
        fc.nat({ max: 4 }),
        fc.nat({ max: 4 }),
        fc.boolean(),
        (subject, padL, padR, upper) => {
          const padded = " ".repeat(padL) + (upper ? subject.toUpperCase() : subject.toLowerCase()) + " ".repeat(padR);
          expect(canonicalSubject(padded)).toBe(subject);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("addCustomSubject is idempotent and case-insensitive", () => {
    fc.assert(
      fc.property(NONEMPTY_SUBJECT_TEXT, (raw) => {
        const a = addCustomSubject(raw);
        const b = addCustomSubject(raw.toUpperCase());
        const c = addCustomSubject(raw.toLowerCase());
        expect(b).toBe(a);
        expect(c).toBe(a);
      }),
      { numRuns: 150 },
    );
  });
});

// ---------------- computeHighlightRanges invariants ----------------

describe("property: highlighting ranges", () => {
  it("ranges are within bounds, non-overlapping, and in order", () => {
    fc.assert(
      fc.property(SUBJECT_TEXT, SUBJECT_TEXT, (text, query) => {
        const ranges = computeHighlightRanges(text, query);
        let prevEnd = -1;
        for (const r of ranges) {
          expect(r.start).toBeGreaterThanOrEqual(0);
          expect(r.end).toBeLessThanOrEqual(text.length);
          expect(r.start).toBeLessThan(r.end);
          expect(r.start).toBeGreaterThanOrEqual(prevEnd);
          prevEnd = r.end;
        }
      }),
      { numRuns: 300 },
    );
  });

  it("highlighted slices match the query (or one of its tokens) case-insensitively", () => {
    fc.assert(
      fc.property(SUBJECT_TEXT, NONEMPTY_SUBJECT_TEXT, (text, query) => {
        const ranges = computeHighlightRanges(text, query);
        if (ranges.length === 0) return;
        const norm = normalizeSubject(query);
        const tokens = Array.from(
          new Set([norm, ...norm.split(/\s+/)].map((t) => t.toLowerCase()).filter((t) => t.length >= 2)),
        );
        for (const r of ranges) {
          const slice = text.slice(r.start, r.end).toLowerCase();
          expect(tokens.some((t) => slice === t)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("is deterministic: same input always yields the same ranges", () => {
    fc.assert(
      fc.property(SUBJECT_TEXT, SUBJECT_TEXT, (text, query) => {
        expect(computeHighlightRanges(text, query)).toEqual(computeHighlightRanges(text, query));
      }),
      { numRuns: 200 },
    );
  });

  it("query whose normalization is empty produces no highlights", () => {
    fc.assert(
      fc.property(SUBJECT_TEXT, fc.string({ unit: fc.constantFrom(" ", "\t", "\n"), maxLength: 8 }), (text: string, ws: string) => {
        expect(computeHighlightRanges(text, ws)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});
