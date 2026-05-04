import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
    if (!token) {
      console.error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(token);
  }
  return stripePromise;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  loading?: boolean;
  title?: string;
  description?: string;
  onComplete?: () => void;
}

/**
 * Renders a Stripe Embedded Checkout inside a dialog.
 * The dialog stays mounted until checkout completes or the user closes it.
 */
export function EmbeddedCheckoutModal({
  open,
  onOpenChange,
  clientSecret,
  loading,
  title = "Complete your subscription",
  description,
  onComplete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<{ destroy: () => void } | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function mount() {
      if (!open || !clientSecret || !containerRef.current) return;

      setMountError(null);
      const stripe = await getStripe();
      if (canceled) return;
      if (!stripe) {
        setMountError("Payments are not configured. Please try again later.");
        return;
      }

      try {
        // Tear down any prior instance before re-mounting
        if (checkoutRef.current) {
          try { checkoutRef.current.destroy(); } catch {}
          checkoutRef.current = null;
        }

        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret: async () => clientSecret,
          onComplete: () => {
            toast.success("Payment confirmed — unlocking your circle…");
            onComplete?.();
          },
        });
        if (canceled) {
          checkout.destroy();
          return;
        }
        checkout.mount(containerRef.current!);
        checkoutRef.current = checkout as unknown as { destroy: () => void };
      } catch (err) {
        console.error("[EmbeddedCheckout] mount failed", err);
        setMountError(err instanceof Error ? err.message : "Could not load checkout");
      }
    }

    mount();
    return () => {
      canceled = true;
      if (checkoutRef.current) {
        try { checkoutRef.current.destroy(); } catch {}
        checkoutRef.current = null;
      }
    };
  }, [open, clientSecret, onComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {(loading || (!clientSecret && !mountError)) && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Preparing secure checkout…</p>
          </div>
        )}

        {mountError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3">
            {mountError}
          </div>
        )}

        {!loading && clientSecret && (
          <>
            <div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs px-3 py-2">
              Test mode — use card <span className="font-mono">4242 4242 4242 4242</span>, any future date, any CVC.
            </div>
            <div ref={containerRef} className="min-h-[400px]" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
