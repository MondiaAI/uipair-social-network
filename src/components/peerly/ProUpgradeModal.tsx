import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FEATURES = [
  "Unlimited Lab project sessions",
  "Priority Partner Matching (shown first)",
  "Advanced file storage (5GB vs 500MB)",
  "Verified Pro badge on profile",
  "Access to premium Study Circles",
  "Analytics on your gigs and posts",
];

export function ProUpgradeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

  const startTrial = () => {
    toast.info("Stripe checkout coming soon — payments setup pending.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-2xl">Unlock UiPair Pro</DialogTitle>
        </DialogHeader>

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

        <Button onClick={startTrial} className="w-full" size="lg">Start 7-day free trial</Button>
        <p className="text-center text-xs text-muted-foreground">Powered by Stripe • Cancel anytime</p>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          By subscribing, you agree to our{" "}
          <a href="/terms" className="underline hover:text-foreground">purchaser terms</a>.
          Subscriptions auto-renew until you cancel. You can cancel anytime, but
          at least <span className="font-medium">24 hours prior to renewal</span> to
          avoid additional charges. Prices are subject to change. Manage your
          subscription through the platform you subscribed on.
        </p>
      </DialogContent>
    </Dialog>
  );
}
