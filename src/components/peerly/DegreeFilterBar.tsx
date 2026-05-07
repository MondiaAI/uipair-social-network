import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEGREE_KEY = "peerly.filters.degree";
const DEGREE_EVT = "peerly:degree-changed";

/** Shared degree filter — synced across all pages via localStorage + event. */
export function useSharedDegree() {
  const [value, setValue] = useState<DegreeKey>(() => {
    if (typeof window === "undefined") return "all";
    try {
      return ((localStorage.getItem(DEGREE_KEY) as DegreeKey) || "all") as DegreeKey;
    } catch {
      return "all";
    }
  });
  useEffect(() => {
    const onCustom = (e: Event) => {
      const v = ((e as CustomEvent<DegreeKey>).detail ?? "all") as DegreeKey;
      setValue((prev) => (prev === v ? prev : v));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DEGREE_KEY) return;
      setValue((e.newValue as DegreeKey) || "all");
    };
    window.addEventListener(DEGREE_EVT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DEGREE_EVT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const update = (v: DegreeKey) => {
    setValue(v);
    try {
      if (v === "all") localStorage.removeItem(DEGREE_KEY);
      else localStorage.setItem(DEGREE_KEY, v);
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DEGREE_EVT, { detail: v }));
    }
  };
  return [value, update] as const;
}


export const DEGREE_FILTERS = [
  { key: "BBA", match: ["BBA", "Business Administration"] },
  { key: "BSc", match: ["BSc", "BSc Nursing"] },
  { key: "BEng", match: ["BEng", "Engineering"] },
  { key: "LLB", match: ["LLB", "Law"] },
  { key: "MBA", match: ["MBA"] },
  { key: "MSc", match: ["MSc"] },
  { key: "MA", match: ["MA "] },
  { key: "PhD", match: ["PhD", "Doctoral"] },
] as const;

export type DegreeKey = (typeof DEGREE_FILTERS)[number]["key"] | "all";

export function matchesDegree(subject: string | null | undefined, degree: DegreeKey): boolean {
  if (degree === "all" || !subject) return true;
  const cfg = DEGREE_FILTERS.find((d) => d.key === degree);
  if (!cfg) return true;
  const s = subject.toLowerCase();
  return cfg.match.some((m) => s.includes(m.toLowerCase()));
}

export function DegreeFilterBar({
  value,
  onChange,
  className,
}: {
  value: DegreeKey;
  onChange: (k: DegreeKey) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
        Degree:
      </span>
      <Button
        type="button"
        size="sm"
        variant={value === "all" ? "default" : "outline"}
        className="h-7 rounded-full px-3 text-xs"
        onClick={() => onChange("all")}
      >
        All
      </Button>
      {DEGREE_FILTERS.map((d) => (
        <Button
          key={d.key}
          type="button"
          size="sm"
          variant={value === d.key ? "default" : "outline"}
          className="h-7 rounded-full px-3 text-xs"
          onClick={() => onChange(d.key)}
        >
          {d.key}
        </Button>
      ))}
    </div>
  );
}
