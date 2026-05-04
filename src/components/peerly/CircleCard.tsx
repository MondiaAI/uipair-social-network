import { Link } from "@tanstack/react-router";
import { Crown, Lock, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { subjectChipClass } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export interface CircleCardData {
  id: string;
  name: string;
  subject: string;
  description: string | null;
  scope: "campus" | "global";
  is_premium: boolean;
  price_monthly: number | null;
  member_count: number;
  leader: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
}

export function CircleCard({
  circle,
  joined,
  onJoin,
}: {
  circle: CircleCardData;
  joined: boolean;
  onJoin: (id: string) => void;
}) {
  const leaderName = circle.leader?.full_name || circle.leader?.username || "Unknown";
  const leaderInitials = leaderName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/circles/$circleId"
          params={{ circleId: circle.id }}
          className="font-semibold text-base leading-snug hover:underline line-clamp-2"
        >
          {circle.name}
        </Link>
        {circle.is_premium && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-xs px-2 py-0.5 rounded-full border", subjectChipClass(circle.subject))}>
          {circle.subject}
        </span>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {circle.scope}
        </Badge>
        {circle.is_premium && circle.price_monthly && (
          <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">
            ${Number(circle.price_monthly).toFixed(0)}/mo
          </Badge>
        )}
      </div>

      {circle.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{circle.description}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>{circle.member_count} members</span>
        <span>·</span>
        <Crown className="h-3.5 w-3.5 text-amber-500" />
        <Avatar className="h-5 w-5">
          <AvatarImage src={circle.leader?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[9px]">{leaderInitials}</AvatarFallback>
        </Avatar>
        <span className="truncate">{leaderName}</span>
      </div>

      <div className="flex gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link to="/circles/$circleId" params={{ circleId: circle.id }}>Open</Link>
        </Button>
        {!joined && (
          circle.is_premium ? (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onJoin(circle.id)}>
              Subscribe ${Number(circle.price_monthly ?? 0).toFixed(0)}/mo
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onJoin(circle.id)}>
              Join
            </Button>
          )
        )}
      </div>
    </div>
  );
}
