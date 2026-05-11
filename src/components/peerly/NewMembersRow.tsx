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
  /** Minimum horizontal distance in pixels to register a swipe. Default 40. */
  swipeThreshold?: number;
}

export function NewMembersRow({ title = "New on UiPair", limit = 12, scoped = true, swipeThreshold = 40 }: Props) {
  const { user, profile } = useAuth();
  const { mode } = useFeedMode();
  const { following, follow, unfollow } = useFollows();
  const [members, setMembers] = useState<NewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartScroll = useRef<number>(0);

  const updatePaging = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const pages = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    setPageCount(pages);
    setActivePage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const goTo = (page: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(updatePaging, 50);
    const onResize = () => updatePaging();
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, [members, loading]);

  useEffect(() => {
    if (paused || loading || pageCount <= 1) return;
    const id = setInterval(() => goTo((activePage + 1) % pageCount), 4000);
    return () => clearInterval(id);
  }, [paused, loading, pageCount, activePage]);

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
    <section
      className="rounded-2xl border bg-card p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {title}
        </h2>
        <div className="flex items-center gap-1">
          {pageCount > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={paused ? "Play" : "Pause"}
                aria-label={paused ? "Play slideshow" : "Pause slideshow"}
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => goTo((activePage - 1 + pageCount) % pageCount)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goTo((activePage + 1) % pageCount)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <Link to="/match" className="ml-1 text-xs text-primary hover:underline">
            See all
          </Link>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div
            ref={scrollerRef}
            onScroll={updatePaging}
            onTouchStart={(e) => {
              setPaused(true);
              touchStartX.current = e.touches[0].clientX;
              touchStartY.current = e.touches[0].clientY;
              touchStartScroll.current = scrollerRef.current?.scrollLeft ?? 0;
            }}
            onTouchEnd={(e) => {
              const startX = touchStartX.current;
              const startY = touchStartY.current;
              if (startX == null || startY == null) return;
              const dx = e.changedTouches[0].clientX - startX;
              const dy = e.changedTouches[0].clientY - startY;
              touchStartX.current = null;
              touchStartY.current = null;
              // Only treat as a horizontal swipe if mostly horizontal and significant
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) goTo((activePage + 1) % pageCount);
                else goTo((activePage - 1 + pageCount) % pageCount);
              }
              // Resume autoplay shortly after the swipe
              setTimeout(() => setPaused(false), 600);
            }}
            className="-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 snap-x snap-mandatory touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {members.map((m) => {
              const name = m.full_name || m.username || "Student";
              const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
              const isFollowing = following.has(m.id);
              return (
                <div
                  key={m.id}
                  className="group flex w-32 shrink-0 snap-start flex-col items-center rounded-lg border bg-background p-3 text-center transition hover:shadow-md"
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
          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (i === activePage ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50")
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
