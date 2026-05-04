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
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { subjectChipClass } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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

interface ProfileLite { id: string; full_name: string | null; username: string | null; avatar_url: string | null; }
interface PostRow { id: string; content: string; created_at: string; user_id: string; }
interface ResourceRow { id: string; title: string; url: string; resource_type: string; created_at: string; user_id: string; }
interface SessionRow { id: string; title: string; description: string | null; scheduled_at: string; join_url: string | null; user_id: string; }

function CircleDetailPage() {
  const { circleId } = useParams({ from: "/_app/circles/$circleId" });
  const { user } = useAuth();
  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [leader, setLeader] = useState<ProfileLite | null>(null);
  const [members, setMembers] = useState<ProfileLite[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, ProfileLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionUrl, setSessionUrl] = useState("");
  const [resOpen, setResOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [confirmJoinOpen, setConfirmJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  const isMember = members.some((m) => m.id === user?.id);

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
    setPosts((p ?? []) as PostRow[]);
    setResources((r ?? []) as ResourceRow[]);
    setSessions((s ?? []) as SessionRow[]);
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

  const confirmJoin = async () => {
    if (!user || !circle) return;
    if (circle.is_premium) {
      toast.info("Premium subscriptions coming soon");
      setConfirmJoinOpen(false);
      return;
    }
    setJoining(true);
    const { error } = await supabase.from("circle_members").insert({ circle_id: circleId, user_id: user.id });
    setJoining(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Joined circle!");
    setConfirmJoinOpen(false);
    load();
  };

  const handlePost = async () => {
    if (!user || !postContent.trim()) return;
    const { error } = await supabase.from("circle_posts").insert({ circle_id: circleId, user_id: user.id, content: postContent.trim() });
    if (error) { toast.error(error.message); return; }
    setPostContent("");
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
          {!isMember && (
            <Button onClick={requestJoin} className={circle.is_premium ? "bg-gradient-to-r from-primary to-primary/70" : ""}>
              {circle.is_premium ? <><Sparkles className="h-4 w-4" /> Subscribe ${Number(circle.price_monthly).toFixed(0)}/mo</> : "Join"}
            </Button>
          )}
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
      </div>

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
              <Textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="Share something with the circle…" rows={3} />
              <div className="flex justify-end">
                <Button size="sm" onClick={handlePost} disabled={!postContent.trim()}>Post</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Read-only preview — {circle.is_premium ? "subscribe" : "join"} to post and comment.
            </div>
          )}
          {posts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No posts yet.</p>
          ) : posts.map((p) => {
            const author = profileMap.get(p.user_id);
            const name = author?.full_name || author?.username || "Member";
            const init = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={p.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-7 w-7"><AvatarImage src={author?.avatar_url ?? undefined} /><AvatarFallback className="text-xs">{init}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{p.content}</p>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="resources" className="mt-4 space-y-3">
          {isMember && (
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
          )}
          {resources.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No resources yet.</p>
          ) : resources.map((r) => (
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
          {isMember && (
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
          )}
          {sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No upcoming sessions.</p>
          ) : sessions.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.scheduled_at).toLocaleString()}</p>
              </div>
              {s.join_url && (
                <Button asChild size="sm"><a href={s.join_url} target="_blank" rel="noopener noreferrer">Join</a></Button>
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
    </div>
  );
}
