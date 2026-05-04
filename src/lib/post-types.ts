export type PostType = "brainstorm" | "research" | "partner" | "question" | "resource";

export const POST_TYPE_META: Record<
  PostType,
  { label: string; emoji: string; bar: string; chipBg: string; chipText: string; ring: string }
> = {
  research: {
    label: "Research",
    emoji: "🔬",
    bar: "border-t-[var(--post-research)]",
    chipBg: "bg-[var(--post-research-soft)]",
    chipText: "text-[var(--post-research)]",
    ring: "ring-[var(--post-research)]",
  },
  partner: {
    label: "Partner",
    emoji: "🤝",
    bar: "border-t-[var(--post-partner)]",
    chipBg: "bg-[var(--post-partner-soft)]",
    chipText: "text-[var(--post-partner)]",
    ring: "ring-[var(--post-partner)]",
  },
  brainstorm: {
    label: "Brainstorm",
    emoji: "💡",
    bar: "border-t-[var(--post-brainstorm)]",
    chipBg: "bg-[var(--post-brainstorm-soft)]",
    chipText: "text-[var(--post-brainstorm)]",
    ring: "ring-[var(--post-brainstorm)]",
  },
  question: {
    label: "Question",
    emoji: "❓",
    bar: "border-t-[var(--post-question)]",
    chipBg: "bg-[var(--post-question-soft)]",
    chipText: "text-[var(--post-question)]",
    ring: "ring-[var(--post-question)]",
  },
  resource: {
    label: "Resource",
    emoji: "📚",
    bar: "border-t-[var(--post-resource)]",
    chipBg: "bg-[var(--post-resource-soft)]",
    chipText: "text-[var(--post-resource)]",
    ring: "ring-[var(--post-resource)]",
  },
};

export const COMPOSER_TAGS: PostType[] = ["research", "partner", "brainstorm", "question"];
export const FILTER_TYPES: (PostType | "all")[] = [
  "all",
  "research",
  "partner",
  "brainstorm",
  "question",
  "resource",
];
