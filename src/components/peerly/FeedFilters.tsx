import { cn } from "@/lib/utils";
import { FILTER_TYPES, POST_TYPE_META, type PostType } from "@/lib/post-types";

export type FeedFilter = PostType | "all";

const LABELS: Record<FeedFilter, string> = {
  all: "All",
  research: "Pair-research",
  partner: "Partner",
  brainstorm: "Brainstorm",
  question: "Questions",
  resource: "Resources",
};

export function FeedFilters({ value, onChange }: { value: FeedFilter; onChange: (v: FeedFilter) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {FILTER_TYPES.map((f) => {
        const active = f === value;
        const meta = f !== "all" ? POST_TYPE_META[f] : null;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted text-muted-foreground",
            )}
          >
            {meta?.emoji && <span className="mr-1">{meta.emoji}</span>}
            {LABELS[f]}
          </button>
        );
      })}
    </div>
  );
}
