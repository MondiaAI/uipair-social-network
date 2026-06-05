import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeSubject,
  canonicalSubject,
  addCustomSubject,
  getCustomSubjects,
  subjectLabel,
} from "@/lib/subjects";

// jsdom-like localStorage shim for Node-based vitest default env
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

describe("normalizeSubject", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSubject("   computer    science   ")).toBe("Computer Science");
  });
  it("returns empty for empty/whitespace input", () => {
    expect(normalizeSubject("")).toBe("");
    expect(normalizeSubject("   ")).toBe("");
  });
  it("title-cases lowercase words", () => {
    expect(normalizeSubject("data science")).toBe("Data Science");
  });
  it("preserves all-caps acronyms", () => {
    expect(normalizeSubject("AI fundamentals")).toBe("AI Fundamentals");
    expect(normalizeSubject("PhD studies")).toBe("PhD Studies");
  });
  it("keeps small connector words lowercase when not leading", () => {
    expect(normalizeSubject("history of art")).toBe("History of Art");
    expect(normalizeSubject("of the people")).toBe("Of the People");
  });
  it("handles slashes and hyphens by capitalizing each segment", () => {
    expect(normalizeSubject("ai/ml")).toBe("Ai/Ml");
    expect(normalizeSubject("e-commerce strategy")).toBe("E-Commerce Strategy");
  });
});

describe("canonicalSubject", () => {
  beforeEach(() => {
    (globalThis.localStorage as MemStorage).clear();
  });
  it("matches built-in subject case-insensitively", () => {
    expect(canonicalSubject("computer science")).toBe("Computer Science");
    expect(canonicalSubject("  MBA  ")).toBe("MBA");
  });
  it("returns normalized new value for unknown subject", () => {
    expect(canonicalSubject("quantum cryptography")).toBe("Quantum Cryptography");
  });
  it("returns existing custom subject (case-insensitive) once added", () => {
    addCustomSubject("Quantum Cryptography");
    expect(canonicalSubject("quantum  cryptography")).toBe("Quantum Cryptography");
  });
  it("returns empty for empty input", () => {
    expect(canonicalSubject("   ")).toBe("");
  });
});

describe("addCustomSubject de-duplication", () => {
  beforeEach(() => {
    (globalThis.localStorage as MemStorage).clear();
  });
  it("dedupes case-insensitively and normalizes spaces", () => {
    expect(addCustomSubject("astro physics")).toBe("Astro Physics");
    expect(addCustomSubject("ASTRO   physics")).toBe("Astro Physics");
    expect(getCustomSubjects()).toEqual(["Astro Physics"]);
  });
  it("returns built-in when matching a built-in subject", () => {
    expect(addCustomSubject("computer science")).toBe("Computer Science");
    expect(getCustomSubjects()).toEqual([]);
  });
});

describe("subject filter/search matching behaviour", () => {
  // Mirrors the comparison logic used in circles.index.tsx and circles.discover.tsx
  const norm = (s: string) => normalizeSubject(s).toLowerCase();
  const displayed = (subject: string, custom?: string | null) =>
    subjectLabel(subject, custom);

  it("matches built-in subject across casing/spacing", () => {
    const filter = " computer  SCIENCE ";
    const d = displayed("Computer Science");
    expect(norm(d)).toBe(norm(filter));
  });

  it("matches custom subject stored as Other + custom_subject", () => {
    const d = displayed("Other", "  quantum  cryptography ");
    expect(norm(d)).toBe(norm("Quantum Cryptography"));
  });

  it("partial 'Other' filter matches via inclusion on normalized form", () => {
    const d = displayed("Other", "Astro Physics");
    const customQuery = norm("astro");
    expect(norm(d).includes(customQuery)).toBe(true);
  });

  it("free-text search hits canonical label", () => {
    const d = displayed("Other", "Marine Biology");
    expect(norm(d).includes(norm("marine"))).toBe(true);
  });
});

describe("normalizeSubject — punctuation & accents", () => {
  it("preserves accented characters and capitalizes them", () => {
    expect(normalizeSubject("économie numérique")).toBe("Économie Numérique");
    expect(normalizeSubject("naïve bayes")).toBe("Naïve Bayes");
    expect(normalizeSubject("café au lait")).toBe("Café Au Lait");
  });

  it("keeps trailing/embedded punctuation intact", () => {
    expect(normalizeSubject("C++ programming")).toBe("C++ Programming");
    expect(normalizeSubject("data-science!!")).toBe("Data-Science!!");
    expect(normalizeSubject("history & philosophy")).toBe("History & Philosophy");
  });

  it("capitalizes each hyphen/slash segment", () => {
    expect(normalizeSubject("math/stats")).toBe("Math/Stats");
    expect(normalizeSubject("ai/ml systems")).toBe("Ai/Ml Systems");
  });

  it("preserves mixed-case acronyms like AI/ML and Roman numerals", () => {
    expect(normalizeSubject("AI/ML systems")).toBe("AI/ML Systems");
    expect(normalizeSubject("HIST II survey")).toBe("HIST II Survey");
  });

  it("normalizes consecutive spaces and tabs/newlines", () => {
    expect(normalizeSubject("data\t\nscience  101")).toBe("Data Science 101");
  });

  it("keeps non-leading small connectors lowercase across languages", () => {
    expect(normalizeSubject("université de kigali")).toBe("Université de Kigali");
    expect(normalizeSubject("história do brasil")).toBe("História do Brasil");
  });
});

describe("canonicalSubject — punctuation, accents, partials", () => {
  beforeEach(() => {
    (globalThis.localStorage as MemStorage).clear();
  });

  it("does not collapse accented input to an unaccented built-in", () => {
    // "Economics" exists as a built-in; "économics" should NOT match it.
    expect(canonicalSubject("économics")).toBe("Économics");
  });

  it("partial subject string does not match a longer built-in", () => {
    // "Comp Sci" is a partial — should be treated as a new normalized value.
    expect(canonicalSubject("comp sci")).toBe("Comp Sci");
    expect(canonicalSubject("computer")).toBe("Computer");
  });

  it("returns same canonical form for repeated calls with different punctuation/spacing", () => {
    addCustomSubject("Quantum-Crypto");
    expect(canonicalSubject("quantum-crypto")).toBe("Quantum-Crypto");
    expect(canonicalSubject("  QUANTUM-CRYPTO ")).toBe("Quantum-Crypto");
  });

  it("custom subjects with accents are deduped case-insensitively", () => {
    expect(addCustomSubject("économie numérique")).toBe("Économie Numérique");
    expect(addCustomSubject("ÉCONOMIE NUMÉRIQUE")).toBe("Économie Numérique");
    expect(getCustomSubjects()).toEqual(["Économie Numérique"]);
  });

  it("partial-word filter ('astro') matches longer canonical ('Astrophysics')", () => {
    // Mirrors the 'Other' branch which uses substring inclusion on normalized form.
    const norm = (s: string) => normalizeSubject(s).toLowerCase();
    expect(norm("Astrophysics").includes(norm("astro"))).toBe(true);
    expect(norm("Astro Physics").includes(norm("astro"))).toBe(true);
  });

  it("free-text search does not accidentally match across token boundaries when normalized", () => {
    const norm = (s: string) => normalizeSubject(s).toLowerCase();
    // "ence ma" should not appear in canonical "Computer Science | Mathematics"
    expect(norm("Computer Science Mathematics").includes(norm("ence ma"))).toBe(true);
    // sanity: completely unrelated query does not match
    expect(norm("Computer Science").includes(norm("biology"))).toBe(false);
  });
});

import { computeHighlightRanges } from "@/components/peerly/Highlight";

describe("computeHighlightRanges (deterministic overlap)", () => {

  it("returns empty for empty inputs", () => {
    expect(computeHighlightRanges("", "x")).toEqual([]);
    expect(computeHighlightRanges("hello", "")).toEqual([]);
  });

  it("matches case-insensitively with start/end indices", () => {
    const r = computeHighlightRanges("Computer Science 101", "computer");
    expect(r).toEqual([{ start: 0, end: 8 }]);
  });

  it("longest token wins over its sub-token at the same position", () => {
    // tokens: ["data science","data","science"] — longest must take the span.
    const r = computeHighlightRanges("Intro to Data Science class", "data science");
    expect(r).toEqual([{ start: 9, end: 21 }]);
  });

  it("returns non-overlapping ranges in order", () => {
    const r = computeHighlightRanges("data science and data ethics", "data ethics");
    // tokens: data ethics, data, ethics. Earliest match for "data" wins at 0,
    // then cursor=4, next earliest is "data ethics" at 17.
    expect(r).toEqual([
      { start: 0, end: 4 },
      { start: 17, end: 28 },
    ]);
  });

  it("handles repeated occurrences left-to-right", () => {
    const r = computeHighlightRanges("ai ai ai", "ai");
    expect(r).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 5 },
      { start: 6, end: 8 },
    ]);
  });

  it("ignores 1-char tokens to avoid noisy single-letter highlights", () => {
    const r = computeHighlightRanges("A study of biology", "a biology");
    // Only "biology" qualifies (len>=2 after split).
    expect(r).toEqual([{ start: 11, end: 18 }]);
  });
});

