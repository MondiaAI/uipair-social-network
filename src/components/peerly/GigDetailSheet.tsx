import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Check, Clock } from "lucide-react";
import { CATEGORY_CHIP, CATEGORY_LABEL, formatPrice, type GigCategory } from "@/lib/gig-meta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type GigDetail = {
  id: string;
  title: string;
  category: GigCategory;
  description: string | null;
  included_items: string[];
  price_cents: number;
  delivery_days: number;
  rating_avg: number;
  review_count: number;
  order_count: number;
  seller_id: string;
  seller: { username: string | null; full_name: string | null; avatar_url: string | null; university: string | null } | null;
};

export function GigDetailSheet({ gigId, open, onOpenChange }: { gigId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const [gig, setGig] = useState<GigDetail | null>(null);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    if (!gigId || !open) { setGig(null); return; }
    (async () => {
      const { data } = await supabase
        .from("gigs")
        .select("id,title,category,description,included_items,price_cents,delivery_days,rating_avg,review_count,order_count,seller_id,seller:profiles!gigs_seller_id_fkey(username,full_name,avatar_url,university)")
        .eq("id", gigId)
        .maybeSingle();
      // fallback if FK alias not present
      if (!data) {
        const base = await supabase.from("gigs").select("*").eq("id", gigId).maybeSingle();
        if (base.data) {
          const { data: profile } = await supabase.from("profiles").select("username,full_name,avatar_url,university").eq("id", base.data.seller_id).maybeSingle();
          setGig({ ...(base.data as any), seller: profile ?? null });
        }
        return;
      }
      setGig(data as any);
    })();
  }, [gigId, open]);

  const order = async () => {
    if (!user || !gig) return;
    if (user.id === gig.seller_id) return toast.error("You can't order your own gig");
    setOrdering(true);
    const { error } = await supabase.from("gig_orders").insert({
      gig_id: gig.id,
      buyer_id: user.id,
      seller_id: gig.seller_id,
      amount_cents: gig.price_cents,
      status: "pending",
    });
    setOrdering(false);
    if (error) return toast.error(error.message);
    toast.success("Order placed! Seller has been notified.");
    onOpenChange(false);
  };

  const name = gig?.seller?.full_name ?? gig?.seller?.username ?? "Seller";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        {!gig ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-left">{gig.title}</SheetTitle>
            </SheetHeader>
            <div className="mx-auto mt-4 max-w-2xl space-y-5">
              <Badge variant="outline" className={cn("w-fit", CATEGORY_CHIP[gig.category])}>{CATEGORY_LABEL[gig.category]}</Badge>

              {gig.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{gig.description}</p>}

              {gig.included_items.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">What's included</h4>
                  <ul className="space-y-1.5">
                    {gig.included_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={gig.seller?.avatar_url ?? undefined} />
                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{name}</p>
                    {gig.seller?.university && <p className="text-xs text-muted-foreground">{gig.seller.university}</p>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{gig.rating_avg.toFixed(1)} ({gig.review_count})</p>
                    <p>{gig.order_count} orders</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />Delivered in {gig.delivery_days} days</span>
                <span className="text-lg font-bold text-emerald-600">{formatPrice(gig.price_cents)}</span>
              </div>

              <Button onClick={order} disabled={ordering} className="w-full" size="lg">
                {ordering ? "Placing order…" : `Order for ${formatPrice(gig.price_cents)}`}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Stripe checkout will be enabled once payments are connected. For now, your order is recorded and the seller is notified.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
