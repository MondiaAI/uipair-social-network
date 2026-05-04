import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatPrice } from "@/lib/gig-meta";
import { subjectChipClass } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export type ResourceCardData = {
  id: string;
  title: string;
  subject: string;
  price_cents: number;
  download_count: number;
  uploader: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

export function ResourceCard({ resource, onBuy }: { resource: ResourceCardData; onBuy: (id: string) => void }) {
  const name = resource.uploader?.full_name ?? resource.uploader?.username ?? "Uploader";
  const free = resource.price_cents === 0;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <Badge variant="outline" className={cn("w-fit", subjectChipClass(resource.subject))}>{resource.subject}</Badge>
      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{resource.title}</h3>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="h-5 w-5"><AvatarImage src={resource.uploader?.avatar_url ?? undefined} /><AvatarFallback>{name.charAt(0)}</AvatarFallback></Avatar>
        <span className="truncate">{name}</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" />{resource.download_count}</span>
      </div>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-base font-bold text-emerald-600">{free ? "Free" : formatPrice(resource.price_cents)}</span>
        <Button size="sm" onClick={() => onBuy(resource.id)}>{free ? "Download" : "Buy & Download"}</Button>
      </div>
    </Card>
  );
}
