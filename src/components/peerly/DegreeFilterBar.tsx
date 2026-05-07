import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
