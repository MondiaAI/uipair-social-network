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
    expect(normalizeSubject("of the people")).toBe("of the People");
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
