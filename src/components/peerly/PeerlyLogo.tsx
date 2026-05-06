import { cn } from "@/lib/utils";

type Variant = "light" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, { text: string; tag: string; w: number }> = {
  sm: { text: "text-base", tag: "hidden", w: 28 },
  md: { text: "text-xl", tag: "hidden", w: 36 },
  lg: { text: "text-3xl", tag: "text-[10px]", w: 52 },
  xl: { text: "text-5xl", tag: "text-xs", w: 76 },
};

/**
 * UiPair mark — two linked person arcs inside a rounded square.
 * Uses the app's primary color (no hard-coded brand hex), with a soft
 * accent derived from primary for the secondary person + link node.
 */
export function PeerlyMark({ size = 36, variant = "light" }: { size?: number; variant?: Variant }) {
  const fg = "#ffffff";
  // Soft accent derived from the current primary token so it adapts to themes.
  const soft = "color-mix(in oklch, var(--primary) 35%, white)";
  const link = "color-mix(in oklch, var(--primary) 60%, white)";
  const radius = size * 0.24;

  return (
    <svg
      viewBox="0 0 76 76"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ color: "var(--primary)" }}
    >
      {/* Rounded square background uses currentColor = primary */}
      <rect x="0" y="0" width="76" height="76" rx={radius} fill="currentColor" />

      {/* Left person */}
      <circle cx="26" cy="30" r="9" fill="none" stroke={fg} strokeWidth="2.6" />
      <path d="M14 54 Q14 42 26 42 Q38 42 38 54" fill="none" stroke={fg} strokeWidth="2.6" strokeLinecap="round" />

      {/* Right person (soft) */}
      <circle cx="50" cy="30" r="9" fill="none" stroke={soft} strokeWidth="2.6" />
      <path d="M38 54 Q38 42 50 42 Q62 42 62 54" fill="none" stroke={soft} strokeWidth="2.6" strokeLinecap="round" />

      {/* Link node */}
      <circle cx="38" cy="38" r="3.2" fill={link} />

      {/* subtle variant tweak (kept for API compatibility) */}
      {variant === "dark" ? null : null}
    </svg>
  );
}

export function PeerlyLogo({
  size = "md",
  variant = "light",
  showTagline = false,
  className,
}: {
  size?: Size;
  variant?: Variant;
  showTagline?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  const wordColor = variant === "dark" ? "text-[#EEEDFE]" : "text-foreground";
  const tagColor = variant === "dark" ? "text-[#AFA9EC]" : "text-muted-foreground";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <PeerlyMark size={s.w} variant={variant} />
      <div className="leading-none">
        <span className={cn("font-extrabold tracking-tight", s.text, wordColor)}>
          Ui<span className="font-light">Pair</span>
        </span>
        {showTagline && (
          <p className={cn("mt-1 font-medium uppercase tracking-[0.25em]", s.tag, tagColor)}>
            Find your pair. Build your future.
          </p>
        )}
      </div>
    </div>
  );
}
