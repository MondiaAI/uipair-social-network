import { cn } from "@/lib/utils";

type Variant = "light" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, { box: string; circles: number; text: string; tag: string; w: number }> = {
  sm: { box: "h-8", circles: 28, text: "text-base", tag: "hidden", w: 28 },
  md: { box: "h-10", circles: 36, text: "text-xl", tag: "hidden", w: 36 },
  lg: { box: "h-14", circles: 52, text: "text-3xl", tag: "text-[10px]", w: 52 },
  xl: { box: "h-20", circles: 76, text: "text-5xl", tag: "text-xs", w: 76 },
};

export function PeerlyMark({ size = 36, variant = "light" }: { size?: number; variant?: Variant }) {
  const c1 = "#534AB7";
  const c2 = "#7F77DD";
  const blend = "#6460CC";
  const fg = variant === "dark" ? "#EEEDFE" : "#EEEDFE";
  return (
    <svg viewBox="0 0 192 180" width={size} height={(size * 180) / 192} aria-hidden="true">
      <defs>
        <clipPath id={`pl-cl-${size}`}><circle cx="72" cy="90" r="54" /></clipPath>
      </defs>
      <circle cx="72" cy="90" r="54" fill={c1} />
      <circle cx="120" cy="90" r="54" fill={c2} />
      <circle cx="120" cy="90" r="54" fill={blend} clipPath={`url(#pl-cl-${size})`} />
      <circle cx="72" cy="68" r="13" fill={fg} />
      <path d="M48 118 Q48 96 72 96 Q96 96 96 118" fill={fg} />
      <circle cx="120" cy="68" r="13" fill={fg} />
      <path d="M96 118 Q96 96 120 96 Q144 96 144 118" fill={fg} />
      <circle cx="96" cy="42" r="5" fill="#ffffff" opacity="0.6" />
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
  const wordColor = variant === "dark" ? "text-[#EEEDFE]" : "text-[#26215C]";
  const tagColor = variant === "dark" ? "text-[#AFA9EC]" : "text-[#7F77DD]";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <PeerlyMark size={s.w} variant={variant} />
      <div className="leading-none">
        <span className={cn("font-medium tracking-tight", s.text, wordColor)}>peerly</span>
        {showTagline && (
          <p className={cn("mt-1 font-medium uppercase tracking-[0.25em]", s.tag, tagColor)}>
            Your campus. Every campus.
          </p>
        )}
      </div>
    </div>
  );
}
