import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { useFollows } from "@/hooks/use-follows";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BadgeCheck, Crown, UserPlus, UserCheck, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { toast } from "sonner";

interface NewMember {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
  field_of_study: string | null;
  is_verified: boolean;
  is_pro: boolean;
  created_at: string;
}

interface Props {
  title?: string;
  limit?: number;
  scoped?: boolean;
}

export function NewMembersRow({ title = "New on UiPair", limit = 12, scoped = true }: Props) {
  const { user, profile } = useAuth();
  const { mode } = useFeedMode();
  const { following, follow, unfollow } = useFollows();
  const [members, setMembers] = useState<NewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university, field_of_study, is_verified, is_pro, created_at")
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (scoped && mode === "campus" && profile?.university) {
        q = q.eq("university", profile.university);
      }
      const { data } = await q;
      const filtered = (data ?? []).filter((m) => m.id !== user?.id).slice(0, limit);
      setMembers(filtered as NewMember[]);
      setLoading(false);
    };
    load();
  }, [user?.id, profile?.university, mode, limit, scoped]);

  const toggleFollow = async (id: string, name: string) => {
    if (!user) return;
    setBusy(id);
    try {
      if (following.has(id)) {
        await unfollow(id);
        toast.success(`Unfollowed ${name}`);
      } else {
        await follow(id);
        toast.success(`Following ${name}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update follow");
    } finally {
      setBusy(null);
    }
  };

  if (!loading && members.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {title}
        </h2>
        <Link to="/match" className="text-xs text-primary hover:underline">
          See all
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {members.map((m) => {
            const name = m.full_name || m.username || "Student";
            const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
            const isFollowing = following.has(m.id);
            return (
              <div
                key={m.id}
                className="group flex w-32 shrink-0 flex-col items-center rounded-lg border bg-background p-3 text-center transition hover:shadow-md"
              >
                <Link
                  to="/profile/$userId"
                  params={{ userId: m.id }}
                  className="flex flex-col items-center"
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    {m.is_verified && (
                      <BadgeCheck
                        className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card text-sky-500"
                        aria-label="Verified"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex w-full items-center justify-center gap-1">
                    <p className="line-clamp-1 text-xs font-semibold group-hover:text-primary">
                      {name}
                    </p>
                    {m.is_pro && (
                      <Crown className="h-3 w-3 shrink-0 text-amber-500" aria-label="Pro" />
                    )}
                  </div>
                  <p className="line-clamp-1 w-full text-[10px] text-muted-foreground">
                    {m.field_of_study || m.university || "New member"}
                  </p>
                </Link>
                {m.is_pro && (
                  <Badge variant="outline" className="mt-1 h-4 gap-0.5 border-amber-500/40 px-1 text-[9px] text-amber-600">
                    Pro
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  className="mt-2 h-7 w-full px-2 text-[11px]"
                  disabled={busy === m.id || !user}
                  onClick={() => toggleFollow(m.id, name)}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-3 w-3" /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" /> Follow
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
