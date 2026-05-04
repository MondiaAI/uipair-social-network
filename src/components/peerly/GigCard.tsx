import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Clock } from "lucide-react";
import { CATEGORY_CHIP, CATEGORY_LABEL, formatPrice, type GigCategory } from "@/lib/gig-meta";
import { cn } from "@/lib/utils";

export type GigCardData = {
  id: string;
  title: string;
  category: GigCategory;
  price_cents: number;
  delivery_days: number;
  rating_avg: number;
  review_count: number;
  seller: { username: string | null; full_name: string | null; avatar_url: string | null; university: string | null } | null;
};

export function GigCard({ gig, onOpen }: { gig: GigCardData; onOpen: (id: string) => void }) {
  const name = gig.seller?.full_name ?? gig.seller?.username ?? "Seller";
  return (
    <Card className="flex flex-col gap-3 p-4 hover:shadow-md transition">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={gig.seller?.avatar_url ?? undefined} />
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          {gig.seller?.university && <p className="truncate text-xs text-muted-foreground">{gig.seller.university}</p>}
        </div>
      </div>
      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{gig.title}</h3>
      <Badge variant="outline" className={cn("w-fit", CATEGORY_CHIP[gig.category])}>{CATEGORY_LABEL[gig.category]}</Badge>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          {gig.rating_avg.toFixed(1)} ({gig.review_count})
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {gig.delivery_days}d
        </span>
      </div>
      <div className="mt-auto flex items-end justify-between pt-2">
        <span className="text-lg font-bold text-emerald-600">{formatPrice(gig.price_cents)}</span>
        <Button size="sm" onClick={() => onOpen(gig.id)}>Order Now</Button>
      </div>
    </Card>
  );
}
