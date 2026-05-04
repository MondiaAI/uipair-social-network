import { useMemo } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  title?: string;
  description?: string;
  onComplete?: () => void;
}

/**
 * Renders Stripe Embedded Checkout inside a dialog using the official
 * @stripe/react-stripe-js components.
 */
export function EmbeddedCheckoutModal({
  open,
  onOpenChange,
  clientSecret,
  title = "Complete your subscription",
  description,
  onComplete,
}: Props) {
  // CRITICAL: keep options reference stable per clientSecret. A new object on
  // every render causes EmbeddedCheckoutProvider to throw
  // "You cannot change the client secret after creation".
  const options = useMemo(
    () =>
      clientSecret
        ? {
            fetchClientSecret: async () => clientSecret,
            onComplete: () => {
              toast.success("Payment confirmed — unlocking your circle…");
              onComplete?.();
            },
          }
        : null,
    // onComplete intentionally captured once per clientSecret
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientSecret],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {!clientSecret || !options ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Preparing secure checkout…</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs px-3 py-2">
              Test mode — use card <span className="font-mono">4242 4242 4242 4242</span>, any future date, any CVC.
            </div>
            <div id="checkout" className="min-h-[400px]">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
