export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  score: StrengthLevel;
  label: string;
  color: string; // tailwind bg class
  checks: {
    length: boolean;     // >= 8
    lower: boolean;
    upper: boolean;
    number: boolean;
    symbol: boolean;
  };
}

export function evaluatePassword(pw: string): PasswordStrength {
  const checks = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  let score = 0;
  if (checks.length) score++;
  if (checks.lower && checks.upper) score++;
  if (checks.number) score++;
  if (checks.symbol) score++;
  if (pw.length >= 12 && score >= 3) score = 4;
  const s = Math.min(score, 4) as StrengthLevel;
  const meta = [
    { label: "Too short", color: "bg-destructive" },
    { label: "Weak", color: "bg-destructive" },
    { label: "Fair", color: "bg-amber-500" },
    { label: "Strong", color: "bg-emerald-500" },
    { label: "Very strong", color: "bg-emerald-600" },
  ][s];
  return { score: s, label: meta.label, color: meta.color, checks };
}
