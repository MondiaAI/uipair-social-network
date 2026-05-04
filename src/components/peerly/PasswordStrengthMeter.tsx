import { evaluatePassword } from "@/lib/password-strength";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export function PasswordStrengthMeter({
  value,
  showChecklist = false,
  className,
}: {
  value: string;
  showChecklist?: boolean;
  className?: string;
}) {
  if (!value) return null;
  const { score, label, color, checks } = evaluatePassword(value);
  const segments = 4;
  const filled = score === 0 ? 0 : score;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < filled ? color : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground flex justify-between">
        <span>Password strength</span>
        <span className="font-medium text-foreground">{label}</span>
      </p>
      {showChecklist && (
        <ul className="text-xs text-muted-foreground space-y-0.5 pt-1">
          <Rule ok={checks.length} text="At least 8 characters" />
          <Rule ok={checks.upper && checks.lower} text="Upper & lowercase letters" />
          <Rule ok={checks.number} text="A number" />
          <Rule ok={checks.symbol} text="A symbol" />
        </ul>
      )}
    </div>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={cn("flex items-center gap-1.5", ok && "text-emerald-600")}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-40" />}
      {text}
    </li>
  );
}
