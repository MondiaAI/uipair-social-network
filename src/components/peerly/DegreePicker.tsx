import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DEGREE_OPTIONS = [
  "BBA",
  "BSc",
  "BEng",
  "LLB",
  "MBA",
  "MSc",
  "MA",
  "PhD",
] as const;

export type DegreeOption = (typeof DEGREE_OPTIONS)[number];

export function DegreePicker({
  value,
  onChange,
  className,
  label = "Qualification",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("mt-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
          {label}:
        </span>
        <Button
          type="button"
          size="sm"
          variant={!value ? "default" : "outline"}
          className="h-6 rounded-full px-2.5 text-xs"
          onClick={() => onChange(null)}
        >
          None
        </Button>
        {DEGREE_OPTIONS.map((d) => {
          const active = value === d;
          return (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-6 rounded-full px-2.5 text-xs"
              onClick={() => onChange(d)}
            >
              {d}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function DegreeBadge({
  degree,
  className,
}: {
  degree?: string | null;
  className?: string;
}) {
  if (!degree) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0",
        className,
      )}
    >
      {degree}
    </Badge>
  );
}
