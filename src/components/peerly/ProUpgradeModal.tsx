import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, ShieldAlert, Globe } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isNativeApp, WEB_UPGRADE_URL } from "@/lib/platform";

const FEATURES = [
  "Unlimited Lab project sessions",
  "Priority Partner Matching (shown first)",
  "Advanced file storage (5GB vs 500MB)",
  "Verified Pro badge on profile",
  "Access to premium Study Circles",
  "Analytics on your gigs and posts",
];

type Step = "eligibility" | "plan";

export function ProUpgradeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<Step>("eligibility");
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

  // Eligibility gate
  const [is16, setIs16] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  // Purchaser terms acceptance
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const reset = () => {
    setStep("eligibility");
    setIs16(false);
    setIsEnrolled(false);
    setAcceptedTerms(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const eligibilityOk = is16 && isEnrolled;

  const startTrial = () => {
    if (!acceptedTerms) {
      toast.error("Please accept the Purchaser Terms to continue.");
      return;
    }
    toast.info("Stripe checkout coming soon — payments setup pending.");
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {step === "eligibility" ? "Confirm eligibility" : "Unlock UiPair Pro"}
          </DialogTitle>
        </DialogHeader>

        {step === "eligibility" ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                UiPair Pro is only available to verified university students aged 16 or
                older. Please confirm before continuing.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={is16} onCheckedChange={(v) => setIs16(v === true)} className="mt-0.5" />
                <span className="text-sm leading-relaxed">
                  I confirm that I am <strong>at least 16 years old</strong>.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={isEnrolled} onCheckedChange={(v) => setIsEnrolled(v === true)} className="mt-0.5" />
                <span className="text-sm leading-relaxed">
                  I confirm that I am <strong>currently enrolled at, admitted to, or
                  affiliated with a recognised university</strong>.
                </span>
              </label>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!eligibilityOk}
              onClick={() => setStep("plan")}
            >
              Continue
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              See full eligibility rules in our{" "}
              <a href="/terms" className="underline hover:text-foreground">Terms</a>.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition",
                    plan === p ? "border-primary bg-accent/40" : "border-border hover:border-muted-foreground/40",
                  )}
                >
                  <p className="text-xs font-medium uppercase text-muted-foreground">{p}</p>
                  <p className="mt-1 text-2xl font-bold">{p === "monthly" ? "$4" : "$35"}</p>
                  <p className="text-xs text-muted-foreground">{p === "monthly" ? "/month" : "/year"}</p>
                  {p === "yearly" && <p className="mt-1 text-xs font-semibold text-emerald-600">Save 27%</p>}
                </button>
              ))}
            </div>

            <ul className="space-y-2.5 py-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  id="accept-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(v) => setAcceptedTerms(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="accept-terms" className="text-xs leading-relaxed font-normal cursor-pointer">
                  I have read and agree to the{" "}
                  <a href="/terms#purchaser-terms" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                    Purchaser Terms
                  </a>
                  . I understand my subscription auto-renews until I cancel, and I must
                  cancel at least <span className="font-medium">24 hours before</span>{" "}
                  renewal to avoid additional charges. Prices are subject to change.
                </Label>
              </label>
            </div>

            <Button onClick={startTrial} className="w-full" size="lg" disabled={!acceptedTerms}>
              Start 7-day free trial
            </Button>
            <p className="text-center text-xs text-muted-foreground">Powered by Stripe • Cancel anytime</p>

            <button
              onClick={() => setStep("eligibility")}
              className="mx-auto block text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              ← Back to eligibility
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
