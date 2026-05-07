import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEGREES = [
  "BBA",
  "BSc (General)",
  "BEng",
  "LLB",
  "MBA",
  "MSc (General)",
  "MA (General)",
  "PhD / Doctoral Studies",
] as const;

export function DegreeQuickPicks({
  value,
  onSelect,
  className,
}: {
  value?: string;
  onSelect: (degree: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("mt-2 flex flex-wrap gap-1.5", className)}>
      <span className="self-center text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
        Quick pick:
      </span>
      {DEGREES.map((d) => {
        const active = value === d;
        return (
          <Button
            key={d}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-6 rounded-full px-2.5 text-xs"
            onClick={() => onSelect(d)}
          >
            {d}
          </Button>
        );
      })}
    </div>
  );
}
