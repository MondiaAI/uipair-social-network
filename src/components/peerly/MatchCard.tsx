import { useState } from "react";
import { MessageCircle, GraduationCap, UserPlus, Check, X, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MatchScoreRing } from "./MatchScoreRing";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  deriveStatus,
  sendFriendRequest,
  respondToRequest,
  cancelRequest,
  openConversation,
  type FriendEdge,
} from "@/lib/friends";

export interface MatchProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
  field_of_study: string | null;
  year_of_study: number | null;
  skills: string[] | null;
  goals: string | null;
  last_seen_at: string | null;
}

interface Props {
  profile: MatchProfile;
  score: number;
  edge: FriendEdge | null;
}

export function MatchCard({ profile, score, edge }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const name = profile.full_name || profile.username || "Student";
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const isOnline = profile.last_seen_at
    ? Date.now() - new Date(profile.last_seen_at).getTime() < 5 * 60 * 1000
    : false;

  const status = user ? deriveStatus(edge, user.id) : "none";

  const handleConnect = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await sendFriendRequest(user.id, profile.id);
      toast.success(`Friend request sent to ${name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send request");
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!edge) return;
    setBusy(true);
    try {
      await respondToRequest(edge.id, true);
      toast.success(`You and ${name} are now connected`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!edge) return;
    setBusy(true);
    try {
      await respondToRequest(edge.id, false);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!edge) return;
    setBusy(true);
    try {
      await cancelRequest(edge.id);
    } finally {
      setBusy(false);
    }
  };

  const handleMessage = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(user.id, profile.id);
      navigate({ to: "/messages", search: { c: conversationId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open chat");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative rounded-xl border bg-card p-4 shadow-sm">
      <div className="absolute right-4 top-4">
        <MatchScoreRing score={score} />
      </div>
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          )}
        </div>
        <div className="min-w-0 flex-1 pr-12">
          <h3 className="truncate font-semibold">{name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {profile.university || "—"} {profile.year_of_study ? `· Year ${profile.year_of_study}` : ""}
          </p>
          {profile.field_of_study && (
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-primary" />
              {profile.field_of_study}
            </p>
          )}
          {profile.skills && profile.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.skills.slice(0, 5).map((s) => (
                <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}
          {profile.goals && (
            <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">🎯 {profile.goals}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {status === "none" && (
          <Button size="sm" className="flex-1" onClick={handleConnect} disabled={busy}>
            <UserPlus className="h-4 w-4" /> Connect
          </Button>
        )}
        {status === "outgoing_pending" && (
          <>
            <Button size="sm" variant="outline" className="flex-1" disabled>
              <Clock className="h-4 w-4" /> Request sent
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={busy}>
              Cancel
            </Button>
          </>
        )}
        {status === "incoming_pending" && (
          <>
            <Button size="sm" className="flex-1" onClick={handleAccept} disabled={busy}>
              <Check className="h-4 w-4" /> Accept
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecline} disabled={busy}>
              <X className="h-4 w-4" /> Decline
            </Button>
          </>
        )}
        {status === "friends" && (
          <Button size="sm" className="flex-1" onClick={handleMessage} disabled={busy}>
            <MessageCircle className="h-4 w-4" /> Message
          </Button>
        )}
      </div>
    </div>
  );
}
