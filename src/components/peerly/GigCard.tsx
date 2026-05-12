import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Clock } from "lucide-react";
import { gigCategoryChip, gigCategoryLabel, formatPrice, countryFlag, type GigCategory } from "@/lib/gig-meta";
import { cn } from "@/lib/utils";

export type GigCardData = {
  id: string;
  title: string;
  category: GigCategory;
  custom_category?: string | null;
  price_cents: number;
  delivery_days: number;
  rating_avg: number;
  review_count: number;
  seller: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    university: string | null;
    country?: string | null;
  } | null;
};

export function GigCard({ gig, onOpen }: { gig: GigCardData; onOpen: (id: string) => void }) {
  const name = gig.seller?.full_name ?? gig.seller?.username ?? "Seller";
  const flag = countryFlag(gig.seller?.country);
  const isDownload = gig.category === "notes";
  return (
    <Card className="flex flex-col gap-2.5 p-3 sm:p-4 sm:gap-3 hover:shadow-md transition">
      <div className="flex items-center gap-2">
        <Avatar className="h-9 w-9">
          <AvatarImage src={gig.seller?.avatar_url ?? undefined} />
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {gig.seller?.university ?? "Independent"}{flag && <span className="ml-1">{flag}</span>}
          </p>
        </div>
      </div>
      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{gig.title}</h3>
      <Badge variant="outline" className={cn("w-fit", gigCategoryChip(gig.category))}>{gigCategoryLabel(gig.category, gig.custom_category)}</Badge>
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
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className="text-base sm:text-lg font-bold text-emerald-600 leading-tight">
          {formatPrice(gig.price_cents)}
          <span className="ml-1 text-[10px] sm:text-xs font-normal text-muted-foreground">
            / {isDownload ? "download" : "session"}
          </span>
        </span>
        <Button size="sm" className="shrink-0" onClick={() => onOpen(gig.id)}>
          {isDownload ? "Buy" : "Book"}
        </Button>
      </div>
    </Card>
  );
}
