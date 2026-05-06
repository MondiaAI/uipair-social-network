import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Crown, Users, Calendar, FileText, MessageSquare, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Beaker, HelpCircle, Handshake, BookOpen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { EmbeddedCheckoutModal } from "@/components/peerly/EmbeddedCheckoutModal";
import { CircleCreatorPanel } from "@/components/peerly/CircleCreatorPanel";
import { CircleAnnouncements } from "@/components/peerly/CircleAnnouncements";
import { LogOut } from "lucide-react";
import { createCircleCheckout, verifyCircleCheckout, cancelCircleSubscription } from "@/server/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { subjectChipClass } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

export const Route = createFileRoute("/_app/circles/$circleId")({
  component: CircleDetailPage,
});

interface CircleDetail {
  id: string;
  name: string;
  subject: string;
  description: string | null;
  scope: "campus" | "global";
  is_premium: boolean;
  price_monthly: number | null;
  meeting_schedule: string | null;
  resources_folder_url: string | null;
  member_count: number;
  leader_id: string;
}

type PostKind = "discussion" | "research" | "partner" | "question" | "resource";
interface ProfileLite { id: string; full_name: string | null; username: string | null; avatar_url: string | null; }
interface PostRow { id: string; content: string; created_at: string; user_id: string; post_type: PostKind; }
interface PostCommentRow { id: string; post_id: string; user_id: string; content: string; created_at: string; }
interface ResourceRow { id: string; title: string; url: string; resource_type: string; created_at: string; user_id: string; }
interface SessionRow { id: string; title: string; description: string | null; scheduled_at: string; join_url: string | null; user_id: string; }

function CircleDetailPage() {
  const { circleId } = useParams({ from: "/_app/circles/$circleId" });
  const { user } = useAuth();
  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [leader, setLeader] = useState<ProfileLite | null>(null);
  const [members, setMembers] = useState<ProfileLite[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postComments, setPostComments] = useState<Record<string, PostCommentRow[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, ProfileLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [postKind, setPostKind] = useState<PostKind>("discussion");
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionUrl, setSessionUrl] = useState("");
  const [resOpen, setResOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [confirmJoinOpen, setConfirmJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  } | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const stripeEnv = getStripeEnvironment();
  const isMember = members.some((m) => m.id === user?.id);
  // Premium gating: non-subscribed users see a limited preview only.
  const isPremiumLocked = !!circle?.is_premium && !isMember;
  const PREVIEW_POST_LIMIT = 2;
  const visiblePosts = isPremiumLocked ? posts.slice(0, PREVIEW_POST_LIMIT) : posts;
  const visibleResources = isPremiumLocked ? [] : resources;
  const visibleSessions = isPremiumLocked ? [] : sessions;
  const hiddenPostsCount = Math.max(posts.length - visiblePosts.length, 0);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase.from("circles").select("*").eq("id", circleId).maybeSingle();
    if (!c) { setLoading(false); return; }
    setCircle(c as CircleDetail);

    const { data: mem } = await supabase.from("circle_members").select("user_id").eq("circle_id", circleId);
    const memberIds = (mem ?? []).map((m) => m.user_id);
    const allIds = Array.from(new Set([...memberIds, c.leader_id]));
    const { data: profiles } = allIds.length
      ? await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", allIds)
      : { data: [] as ProfileLite[] };
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p as ProfileLite]));
    setProfileMap(pMap);
    setLeader(pMap.get(c.leader_id) ?? null);
    setMembers(memberIds.map((id) => pMap.get(id)).filter(Boolean) as ProfileLite[]);

    const [{ data: p }, { data: r }, { data: s }] = await Promise.all([
      supabase.from("circle_posts").select("*").eq("circle_id", circleId).order("created_at", { ascending: false }),
      supabase.from("circle_resources").select("*").eq("circle_id", circleId).order("created_at", { ascending: false }),
      supabase.from("circle_sessions").select("*").eq("circle_id", circleId).order("scheduled_at"),
    ]);
    const postsList = (p ?? []) as PostRow[];
    setPosts(postsList);
    setResources((r ?? []) as ResourceRow[]);
    setSessions((s ?? []) as SessionRow[]);

    // Load comments for these posts
    const postIds = postsList.map((x) => x.id);
    if (postIds.length) {
      const { data: cmts } = await supabase
        .from("circle_post_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at");
      const grouped: Record<string, PostCommentRow[]> = {};
      const extraIds = new Set<string>();
      (cmts ?? []).forEach((c) => {
        (grouped[c.post_id] ||= []).push(c as PostCommentRow);
        extraIds.add(c.user_id);
      });
      setPostComments(grouped);
      // Fetch any commenter profiles not already in pMap
      const missing = Array.from(extraIds).filter((id) => !pMap.has(id));
      if (missing.length) {
        const { data: extra } = await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", missing);
        (extra ?? []).forEach((pr) => pMap.set(pr.id, pr as ProfileLite));
        setProfileMap(new Map(pMap));
      }
    } else {
      setPostComments({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [circleId]);

  // Realtime + polling: auto-grant access when membership is created
  // (e.g., after a Stripe subscription webhook inserts the membership row).
  useEffect(() => {
    if (!user || !circleId || isMember) return;

    const channel = supabase
      .channel(`circle-membership-${circleId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "circle_members",
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row.user_id === user.id) {
            toast.success("Access granted — welcome to the circle!");
            load();
          }
        }
      )
      .subscribe();

    // Polling fallback every 15s in case realtime drops or webhook is delayed
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("circle_members")
        .select("user_id")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        toast.success("Access granted — welcome to the circle!");
        load();
      }
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line
  }, [user?.id, circleId, isMember]);

  const requestJoin = () => {
    if (!user || !circle) return;
    setConfirmJoinOpen(true);
  };

  const handleLeave = async () => {
    if (!user || !circle) return;
    if (user.id === circle.leader_id) { toast.error("Leaders can't leave their own circle"); return; }
    if (!confirm(`Leave ${circle.name}? You'll lose access to its discussions and resources.`)) return;
    setLeaving(true);
    const prevMembers = members;
    const prevCount = circle.member_count;
    setMembers((m) => m.filter((x) => x.id !== user.id));
    setCircle((c) => c ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c);
    const { error } = await supabase
      .from("circle_members").delete()
      .eq("circle_id", circleId).eq("user_id", user.id);
    setLeaving(false);
    if (error) {
      setMembers(prevMembers);
      setCircle((c) => c ? { ...c, member_count: prevCount } : c);
      toast.error(error.message || "Could not leave circle");
      return;
    }
    toast.success("Left circle");
  };

  const confirmJoin = async () => {
    if (!user || !circle) return;
    if (circle.is_premium) {
      setJoining(true);
      try {
        const { clientSecret } = await createCircleCheckout({
          data: { circleId: circle.id, environment: stripeEnv },
        });
        setCheckoutClientSecret(clientSecret);
        setConfirmJoinOpen(false);
        setCheckoutOpen(true);
      } catch (err: any) {
        toast.error(err?.message ?? "Could not start checkout");
      } finally {
        setJoining(false);
      }
      return;
    }
    setJoining(true);
    // Optimistic: add user to members immediately
    const optimisticSelf: ProfileLite = {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? null,
      username: (user.user_metadata?.username as string) ?? null,
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    };
    setMembers((prev) => prev.some((m) => m.id === user.id) ? prev : [...prev, optimisticSelf]);
    setCircle((prev) => prev ? { ...prev, member_count: prev.member_count + 1 } : prev);
    setConfirmJoinOpen(false);
    const { error } = await supabase.from("circle_members").insert({ circle_id: circleId, user_id: user.id });
    setJoining(false);
    if (error) {
      // Rollback
      setMembers((prev) => prev.filter((m) => m.id !== user.id));
      setCircle((prev) => prev ? { ...prev, member_count: Math.max(0, prev.member_count - 1) } : prev);
      toast.error(error.message);
      return;
    }
    toast.success("Joined circle!");
    load();
  };

  const handleCheckoutComplete = async () => {
    try {
      const sessionId = new URLSearchParams(window.location.search).get("checkout_session_id");
      if (sessionId) {
        await verifyCircleCheckout({ data: { sessionId, environment: stripeEnv } });
      }
    } catch (err) {
      console.warn("verify after checkout failed (webhook will still grant)", err);
    }
    setCheckoutOpen(false);
    setCheckoutClientSecret(null);
    load();
  };

  const handleCancelSubscription = async () => {
    if (!circle) return;
    if (!confirm("Cancel your subscription? You'll keep access until the end of the current billing period.")) return;
    setCanceling(true);
    try {
      await cancelCircleSubscription({ data: { circleId: circle.id, environment: stripeEnv } });
      toast.success("Subscription canceled — you keep access until the period ends.");
      loadSubscription();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not cancel subscription");
    } finally {
      setCanceling(false);
    }
  };

  const loadSubscription = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("circle_subscriptions")
      .select("status,cancel_at_period_end,current_period_end")
      .eq("user_id", user.id)
      .eq("circle_id", circleId)
      .eq("environment", stripeEnv)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription(data ?? null);
  };

  // Refresh subscription info whenever membership state may have changed.
  useEffect(() => {
    if (isMember) loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember, user?.id, circleId]);

  // Handle return from Stripe — verify on mount if a session_id is in the URL
  // (covers full-page reload after embedded checkout completes).
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("checkout_session_id");
    if (!sessionId || !user) return;
    (async () => {
      try {
        await verifyCircleCheckout({ data: { sessionId, environment: stripeEnv } });
        toast.success("Payment confirmed — checking access…");
        // Strip the param so refresh doesn't re-verify
        url.searchParams.delete("checkout_session_id");
        window.history.replaceState({}, "", url.toString());
        load();
      } catch (err) {
        console.warn("Return-URL verify failed; webhook will still grant", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handlePost = async () => {
    if (!user || !postContent.trim()) return;
    const { error } = await supabase.from("circle_posts").insert({
      circle_id: circleId, user_id: user.id, content: postContent.trim(), post_type: postKind,
    });
    if (error) { toast.error(error.message); return; }
    setPostContent(""); setPostKind("discussion");
    load();
  };

  const handleAddComment = async (postId: string) => {
    if (!user) return;
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    const { error } = await supabase.from("circle_post_comments").insert({
      post_id: postId, circle_id: circleId, user_id: user.id, content: text,
    });
    if (error) { toast.error(error.message); return; }
    setCommentDrafts((d) => ({ ...d, [postId]: "" }));
    load();
  };

  const handleAddResource = async () => {
    if (!user || !resTitle.trim() || !resUrl.trim()) return;
    const { error } = await supabase.from("circle_resources").insert({
      circle_id: circleId, user_id: user.id, title: resTitle.trim(), url: resUrl.trim(), resource_type: "link",
    });
    if (error) { toast.error(error.message); return; }
    setResTitle(""); setResUrl(""); setResOpen(false); load();
  };

  const handleAddSession = async () => {
    if (!user || !sessionTitle.trim() || !sessionDate) return;
    const { error } = await supabase.from("circle_sessions").insert({
      circle_id: circleId, user_id: user.id, title: sessionTitle.trim(),
      scheduled_at: new Date(sessionDate).toISOString(),
      join_url: sessionUrl.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setSessionTitle(""); setSessionDate(""); setSessionUrl(""); setSessionOpen(false); load();
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">Loading…</div>;
  }
  if (!circle) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Circle not found.</p>
        <Button asChild variant="outline"><Link to="/circles"><ArrowLeft className="h-4 w-4" /> Back to circles</Link></Button>
      </div>
    );
  }

  const leaderName = leader?.full_name || leader?.username || "Leader";
  const leaderInitials = leaderName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/circles"><ArrowLeft className="h-4 w-4" /> Circles</Link>
      </Button>

      <div className="rounded-xl border bg-card p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{circle.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full border", subjectChipClass(circle.subject))}>
                {circle.subject}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">{circle.scope}</Badge>
              {circle.is_premium && (
                <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">
                  ${Number(circle.price_monthly).toFixed(0)}/mo
                </Badge>
              )}
            </div>
          </div>
          {!isMember ? (
            <Button onClick={requestJoin} className={circle.is_premium ? "bg-gradient-to-r from-primary to-primary/70" : ""}>
              {circle.is_premium ? <><Sparkles className="h-4 w-4" /> Subscribe ${Number(circle.price_monthly).toFixed(0)}/mo</> : "Join"}
            </Button>
          ) : user?.id !== circle.leader_id && !circle.is_premium ? (
            <Button variant="outline" onClick={handleLeave} disabled={leaving}>
              <LogOut className="h-4 w-4" /> {leaving ? "Leaving…" : "Leave circle"}
            </Button>
          ) : null}
        </div>

        {circle.description && <p className="text-sm text-muted-foreground mb-3">{circle.description}</p>}

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {circle.member_count} members</div>
          <span>·</span>
          <div className="flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-amber-500" />
            <Avatar className="h-5 w-5"><AvatarImage src={leader?.avatar_url ?? undefined} /><AvatarFallback className="text-[9px]">{leaderInitials}</AvatarFallback></Avatar>
            {leaderName}
          </div>
        </div>

        {isMember && circle.is_premium && subscription && user?.id !== circle.leader_id && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              {subscription.cancel_at_period_end ? (
                <>Subscription canceled — access ends{" "}
                  {subscription.current_period_end
                    ? format(new Date(subscription.current_period_end), "MMM d, yyyy")
                    : "soon"}.
                </>
              ) : subscription.status === "past_due" ? (
                <>⚠ Payment past due — Stripe is retrying. Update your card to keep access.</>
              ) : (
                <>Subscribed · renews{" "}
                  {subscription.current_period_end
                    ? format(new Date(subscription.current_period_end), "MMM d, yyyy")
                    : "monthly"}
                </>
              )}
            </div>
            {!subscription.cancel_at_period_end && ["active","trialing","past_due"].includes(subscription.status) && (
              <Button size="sm" variant="outline" onClick={handleCancelSubscription} disabled={canceling}>
                {canceling ? "Canceling…" : "Cancel subscription"}
              </Button>
            )}
          </div>
        )}
      </div>

      {user?.id === circle.leader_id && (
        <CircleCreatorPanel
          circle={circle}
          members={members}
          onUpdated={load}
          onMemberRemoved={(uid) => {
            setMembers((prev) => prev.filter((m) => m.id !== uid));
            setCircle((prev) => prev ? { ...prev, member_count: Math.max(0, prev.member_count - 1) } : prev);
          }}
        />
      )}

      <CircleAnnouncements
        circleId={circleId}
        isLeader={user?.id === circle.leader_id}
        userId={user?.id}
      />

      {!isMember && (
        circle.is_premium ? (
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Premium circle — preview mode</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Subscribe for ${Number(circle.price_monthly).toFixed(0)}/mo to unlock posts, resources, members, and live sessions.
                </p>
                <Button size="sm" className="mt-3 bg-gradient-to-r from-primary to-primary/70" onClick={requestJoin}>
                  <Sparkles className="h-4 w-4" /> Subscribe ${Number(circle.price_monthly).toFixed(0)}/mo
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/30 p-4 mb-6 flex items-start gap-3">
            <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">You're previewing this circle</p>
              <p className="text-xs text-muted-foreground mt-0.5">Join to post, share resources, and schedule sessions.</p>
            </div>
            <Button size="sm" onClick={requestJoin}>Join</Button>
          </div>
        )
      )}

      <Tabs defaultValue="discussion">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="discussion"><MessageSquare className="h-4 w-4 mr-1" /> Discussion</TabsTrigger>
          <TabsTrigger value="resources"><FileText className="h-4 w-4 mr-1" /> Resources</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" /> Members</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1" /> Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="discussion" className="mt-4 space-y-3">
          {isMember ? (
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {([
                  { k: "discussion", label: "Discussion", Icon: MessageSquare },
                  { k: "research", label: "Research", Icon: Beaker },
                  { k: "partner", label: "Find partner", Icon: Handshake },
                  { k: "question", label: "Question", Icon: HelpCircle },
                  { k: "resource", label: "Resource", Icon: BookOpen },
                ] as const).map(({ k, label, Icon }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPostKind(k)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      postKind === k
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-3 w-3" /> {label}
                  </button>
                ))}
              </div>
              <Textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder={
                  postKind === "research" ? "Share a paper, finding, or research direction…"
                  : postKind === "partner" ? "Looking for a study partner — what are you working on?"
                  : postKind === "question" ? "Ask the circle a question…"
                  : postKind === "resource" ? "Describe the resource and paste a link…"
                  : "Share something with the circle…"
                }
                rows={3}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handlePost} disabled={!postContent.trim()}>Post</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Read-only preview — {circle.is_premium ? "subscribe" : "join"} to post and comment.
            </div>
          )}
          {visiblePosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No posts yet.</p>
          ) : visiblePosts.map((p) => {
            const author = profileMap.get(p.user_id);
            const name = author?.full_name || author?.username || "Member";
            const init = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
            const KIND_META: Record<PostKind, { label: string; cls: string }> = {
              discussion: { label: "Discussion", cls: "bg-muted text-foreground" },
              research: { label: "Research", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
              partner: { label: "Partner", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
              question: { label: "Question", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
              resource: { label: "Resource", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
            };
            const kind = KIND_META[p.post_type] ?? KIND_META.discussion;
            const cmts = postComments[p.id] ?? [];
            return (
              <div key={p.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-7 w-7"><AvatarImage src={author?.avatar_url ?? undefined} /><AvatarFallback className="text-xs">{init}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium">{name}</span>
                  <Badge variant="outline" className={cn("text-[10px]", kind.cls)}>{kind.label}</Badge>
                  <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{p.content}</p>

                {(cmts.length > 0 || isMember) && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {cmts.map((c) => {
                      const ca = profileMap.get(c.user_id);
                      const cname = ca?.full_name || ca?.username || "Member";
                      const cinit = cname.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
                      return (
                        <div key={c.id} className="flex gap-2">
                          <Avatar className="h-6 w-6"><AvatarImage src={ca?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{cinit}</AvatarFallback></Avatar>
                          <div className="flex-1 rounded-md bg-muted/50 px-2.5 py-1.5">
                            <p className="text-xs"><span className="font-medium">{cname}</span> <span className="text-muted-foreground">· {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span></p>
                            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                          </div>
                        </div>
                      );
                    })}
                    {isMember && (
                      <div className="flex gap-2">
                        <Input
                          value={commentDrafts[p.id] ?? ""}
                          onChange={(e) => setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(p.id); } }}
                          placeholder="Write a comment…"
                          className="h-8 text-sm"
                        />
                        <Button size="sm" onClick={() => handleAddComment(p.id)} disabled={!(commentDrafts[p.id] ?? "").trim()}>Reply</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {isPremiumLocked && hiddenPostsCount > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center text-sm">
              <Lock className="h-4 w-4 inline mr-1 text-primary" />
              {hiddenPostsCount} more {hiddenPostsCount === 1 ? "post is" : "posts are"} locked — subscribe to read the full discussion.
            </div>
          )}
        </TabsContent>

        <TabsContent value="resources" className="mt-4 space-y-3">
          {isMember ? (
            <Dialog open={resOpen} onOpenChange={setResOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline">+ Add resource</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add a resource</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={resTitle} onChange={(e) => setResTitle(e.target.value)} /></div>
                  <div><Label>URL</Label><Input value={resUrl} onChange={(e) => setResUrl(e.target.value)} placeholder="https://…" /></div>
                  <Button onClick={handleAddResource} className="w-full">Add</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Read-only preview — {circle.is_premium ? "subscribe" : "join"} to upload resources.
            </div>
          )}
          {isPremiumLocked ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center text-sm">
              <Lock className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="font-medium">{resources.length} premium {resources.length === 1 ? "resource is" : "resources are"} locked</p>
              <p className="text-xs text-muted-foreground mt-1">Subscribe to download materials shared by this circle.</p>
            </div>
          ) : visibleResources.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No resources yet.</p>
          ) : visibleResources.map((r) => (
            <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border bg-card p-3 hover:shadow-sm transition">
              <p className="font-medium text-sm">{r.title}</p>
              <p className="text-xs text-muted-foreground truncate">{r.url}</p>
            </a>
          ))}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No members yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {members.map((m) => {
                const name = m.full_name || m.username || "Member";
                const init = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
                const isLeader = m.id === circle.leader_id;
                return (
                  <div key={m.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10"><AvatarImage src={m.avatar_url ?? undefined} /><AvatarFallback>{init}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1">{name} {isLeader && <Crown className="h-3 w-3 text-amber-500" />}</p>
                      {m.username && <p className="text-xs text-muted-foreground truncate">@{m.username}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="mt-4 space-y-3">
          {isMember ? (
            <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline">+ Schedule session</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Schedule a study session</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} /></div>
                  <div><Label>Date & time</Label><Input type="datetime-local" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} /></div>
                  <div><Label>Join URL (optional)</Label><Input value={sessionUrl} onChange={(e) => setSessionUrl(e.target.value)} placeholder="https://meet…" /></div>
                  <Button onClick={handleAddSession} className="w-full">Schedule</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Read-only preview — {circle.is_premium ? "subscribe" : "join"} to schedule live sessions{!isMember && " and access join links"}.
            </div>
          )}
          {isPremiumLocked ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center text-sm">
              <Lock className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="font-medium">{sessions.length} live {sessions.length === 1 ? "session is" : "sessions are"} locked</p>
              <p className="text-xs text-muted-foreground mt-1">Subscribe to view the schedule and join links.</p>
            </div>
          ) : visibleSessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No upcoming sessions.</p>
          ) : visibleSessions.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.scheduled_at).toLocaleString()}</p>
              </div>
              {s.join_url && (
                isMember ? (
                  <Button asChild size="sm"><a href={s.join_url} target="_blank" rel="noopener noreferrer">Join</a></Button>
                ) : (
                  <Button size="sm" variant="outline" disabled title="Join the circle to access live sessions"><Lock className="h-3.5 w-3.5" /> Locked</Button>
                )
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={confirmJoinOpen} onOpenChange={setConfirmJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {circle.is_premium ? `Subscribe to ${circle.name}?` : `Join ${circle.name}?`}
            </DialogTitle>
            <DialogDescription>
              {circle.is_premium ? (
                <>You'll be charged <span className="font-semibold text-foreground">${Number(circle.price_monthly).toFixed(0)}/month</span> to access this premium circle's posts, resources, members, and live sessions. You can cancel anytime.</>
              ) : (
                <>You'll join this circle and gain access to discussions, shared resources, and study sessions.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmJoinOpen(false)} disabled={joining}>Cancel</Button>
            <Button onClick={confirmJoin} disabled={joining} className={circle.is_premium ? "bg-gradient-to-r from-primary to-primary/70" : ""}>
              {joining ? "Please wait…" : circle.is_premium ? `Subscribe $${Number(circle.price_monthly).toFixed(0)}/mo` : "Confirm join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmbeddedCheckoutModal
        open={checkoutOpen}
        onOpenChange={(o) => {
          setCheckoutOpen(o);
          if (!o) setCheckoutClientSecret(null);
        }}
        clientSecret={checkoutClientSecret}
        title={`Subscribe to ${circle.name}`}
        description={`$${Number(circle.price_monthly).toFixed(0)}/month — cancel anytime.`}
        onComplete={handleCheckoutComplete}
      />
    </div>
  );
}
