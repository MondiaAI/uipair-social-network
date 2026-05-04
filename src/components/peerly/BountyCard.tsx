import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, timeAgo } from "@/lib/gig-meta";
import { subjectChipClass } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export type BountyCardData = {
  id: string;
  title: string;
  subject: string;
  reward_cents: number;
  status: string;
  created_at: string;
  poster: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

export function BountyCard({ bounty, onClaim }: { bounty: BountyCardData; onClaim: (id: string) => void }) {
  const name = bounty.poster?.full_name ?? bounty.poster?.username ?? "User";
  return (
    <Card className="flex w-72 shrink-0 flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={cn(subjectChipClass(bounty.subject))}>{bounty.subject}</Badge>
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">{formatPrice(bounty.reward_cents)}</Badge>
      </div>
      <h4 className="line-clamp-2 text-sm font-semibold">{bounty.title}</h4>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="h-5 w-5"><AvatarImage src={bounty.poster?.avatar_url ?? undefined} /><AvatarFallback>{name.charAt(0)}</AvatarFallback></Avatar>
        <span className="truncate">{name}</span>
        <span>•</span>
        <span>{timeAgo(bounty.created_at)}</span>
      </div>
      <Button size="sm" className="mt-1" disabled={bounty.status !== "open"} onClick={() => onClaim(bounty.id)}>
        {bounty.status === "open" ? "Claim Bounty" : "Claimed"}
      </Button>
    </Card>
  );
}
