import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown, Loader2, Lock, MessageSquare, Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  leader: { id?: string; full_name: string | null; username: string | null; avatar_url: string | null } | null;
}

export function CircleCard({
  circle,
  joined,
  onJoin,
  joining = false,
}: {
  circle: CircleCardData;
  joined: boolean;
  onJoin: (id: string) => void;
  joining?: boolean;
}) {
  const leaderName = circle.leader?.full_name || circle.leader?.username || "Unknown";
  const leaderInitials = leaderName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const [previewOpen, setPreviewOpen] = useState(false);

  const price = Number(circle.price_monthly ?? 0).toFixed(0);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="font-semibold text-base leading-snug hover:underline line-clamp-2 text-left"
        >
          {circle.name}
        </button>
        {circle.is_premium && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-xs px-2 py-0.5 rounded-full border", subjectChipClass(circle.subject))}>
          {circle.subject}
        </span>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {circle.scope}
        </Badge>
        {circle.is_premium ? (
          <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">
            ${price}/mo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
            Free
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
        <Button size="sm" className="flex-1" onClick={() => setPreviewOpen(true)}>
          Open
        </Button>
        {!joined && (
          circle.is_premium ? (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onJoin(circle.id)} disabled={joining}>
              {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {joining ? "Joining…" : `Subscribe $${price}/mo`}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onJoin(circle.id)} disabled={joining}>
              {joining && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {joining ? "Joining…" : "Join free"}
            </Button>
          )
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn("text-xs px-2 py-0.5 rounded-full border", subjectChipClass(circle.subject))}>
                {circle.subject}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">{circle.scope}</Badge>
              {circle.is_premium ? (
                <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">
                  Premium · ${price}/mo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                  Free
                </Badge>
              )}
            </div>
            <DialogTitle className="text-left">{circle.name}</DialogTitle>
            <DialogDescription className="text-left whitespace-pre-wrap">
              {circle.description || "No description provided yet — open the circle to learn more."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" /> {circle.member_count} members
              <span>·</span>
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <Avatar className="h-5 w-5">
                <AvatarImage src={circle.leader?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px]">{leaderInitials}</AvatarFallback>
              </Avatar>
              <span>Led by {leaderName}</span>
            </div>
            {circle.is_premium && (
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs text-foreground">
                <span className="font-medium">What you get:</span> exclusive posts, premium resources,
                live mentor sessions, and member directory. Cancel anytime.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            {circle.leader?.id && (
              <Button variant="outline" asChild onClick={() => setPreviewOpen(false)}>
                <Link to="/profile/$userId" params={{ userId: circle.leader.id }}>
                  <MessageSquare className="h-4 w-4" /> Connect with leader
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild onClick={() => setPreviewOpen(false)}>
              <Link to="/circles/$circleId" params={{ circleId: circle.id }}>
                View full page
              </Link>
            </Button>
            {joined ? (
              <Button asChild>
                <Link to="/circles/$circleId" params={{ circleId: circle.id }}>Open circle</Link>
              </Button>
            ) : circle.is_premium ? (
              <Button
                className="bg-gradient-to-r from-primary to-primary/70"
                onClick={() => { setPreviewOpen(false); onJoin(circle.id); }}
              >
                <Sparkles className="h-4 w-4" /> Subscribe ${price}/mo
              </Button>
            ) : (
              <Button onClick={() => { setPreviewOpen(false); onJoin(circle.id); }}>
                Join free
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
