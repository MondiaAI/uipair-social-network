import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Camera, Star, BadgeCheck, GraduationCap, UserPlus, MessageCircle, Check, X, Clock, Send } from "lucide-react";
import { uploadToBucket } from "@/lib/storage";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  deriveStatus,
  sendFriendRequest,
  respondToRequest,
  cancelRequest,
  openConversation,
  startConversationWithMessage,
} from "@/lib/friends";
import { useFriendships } from "@/hooks/use-friendships";
import { PostCard } from "@/components/peerly/PostCard";
import { GigCard } from "@/components/peerly/GigCard";
import { ResourceCard } from "@/components/peerly/ResourceCard";
import { timeAgo } from "@/lib/gig-meta";

export const Route = createFileRoute("/_app/profile/$userId")({
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const isMe = user?.id === userId;
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [gigs, setGigs] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({ posts: 0, circles: 0, gigs: 0 });
  const [following, setFollowing] = useState(false);

  const load = async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(p);
    const [{ data: po, count: pc }, { data: g }, { data: r }, { data: rv }, { count: cc }, { count: gc }] = await Promise.all([
      supabase.from("posts").select("*", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("gigs").select("*").eq("seller_id", userId).eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("resources").select("*").eq("uploader_id", userId).eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("gig_reviews").select("*").eq("seller_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("circle_members").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("gig_orders").select("*", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "completed"),
    ]);
    setPosts(po ?? []); setGigs(g ?? []); setResources(r ?? []); setReviews(rv ?? []);
    setStats({ posts: pc ?? 0, circles: cc ?? 0, gigs: gc ?? 0 });
    if (user && !isMe) {
      const { data: f } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle();
      setFollowing(!!f);
    }
  };

  useEffect(() => { load(); }, [userId, user]);

  const onUpload = async (kind: "avatar" | "cover", file: File) => {
    if (!user || !isMe) return;
    const url = await uploadToBucket(kind === "avatar" ? "avatars" : "covers", user.id, file);
    if (!url) return toast.error("Upload failed");
    const update = kind === "avatar" ? { avatar_url: url } : { cover_url: url };
    await supabase.from("profiles").update(update).eq("id", user.id);
    await refreshProfile();
    load();
  };

  const toggleFollow = async () => {
    if (!user || isMe) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      setFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
      setFollowing(true);
    }
  };

  if (!profile) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  const name = profile.full_name || profile.username || "Student";
  const initials = name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl">
      {/* Cover */}
      <div className="relative h-40 sm:h-56 w-full overflow-hidden bg-gradient-to-br from-primary/30 to-purple-300">
        {profile.cover_url && <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />}
        {isMe && (
          <label className="absolute right-3 top-3 cursor-pointer rounded-full bg-background/90 p-2 shadow hover:bg-background">
            <Camera className="h-4 w-4" />
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload("cover", e.target.files[0])} />
          </label>
        )}
      </div>

      <div className="px-4 sm:px-6 -mt-12">
        <div className="flex items-end justify-between gap-3">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            {isMe && (
              <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-primary p-1.5 text-primary-foreground shadow">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload("avatar", e.target.files[0])} />
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-1">
            {!isMe && user && (
              <>
                <Button size="sm" variant={following ? "outline" : "default"} onClick={toggleFollow}>
                  {following ? "Following" : "Follow"}
                </Button>
                <FriendActions otherId={userId} otherName={name} />
              </>
            )}
            {isMe && <Button size="sm" variant="outline" onClick={() => navigate({ to: "/ambassador" })}>Earn as Ambassador</Button>}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{name}</h1>
            {profile.is_pro && <Badge className="bg-primary text-primary-foreground"><BadgeCheck className="h-3 w-3 mr-1" />Pro</Badge>}
            {profile.is_verified && <Badge variant="outline" className="text-emerald-600 border-emerald-200">Verified</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {(profile.university || profile.field_of_study) && (
            <p className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" />
              {[profile.university, profile.field_of_study, profile.year_of_study && `Year ${profile.year_of_study}`].filter(Boolean).join(" · ")}
            </p>
          )}
          {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          {profile.skills?.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            </div>
          )}
          {profile.interests?.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Interests</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((s: string) => (
                  <Badge key={s} variant="outline" className="border-primary/30 bg-primary/5 text-primary">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl border bg-card p-3 text-center">
          <Stat n={stats.posts} l="Posts" />
          <Stat n={stats.circles} l="Circles" />
          <Stat n={stats.gigs} l="Gigs" />
          <div>
            <div className="inline-flex items-center gap-1 text-lg font-bold">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {profile.reputation_score}
            </div>
            <p className="text-[11px] text-muted-foreground">Reputation</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="posts" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="gigs">Gigs</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="certs">Certifications</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-3 mt-4">
            {posts.length === 0 && <Empty msg="No posts yet" />}
            {posts.map((p) => (
              <Card key={p.id} className="p-4">
                <p className="text-sm">{p.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">{timeAgo(p.created_at)}</p>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="gigs" className="grid gap-3 sm:grid-cols-2 mt-4">
            {gigs.length === 0 && <div className="sm:col-span-2"><Empty msg="No active gigs" /></div>}
            {gigs.map((g) => <GigCard key={g.id} gig={{ ...g, seller: profile }} onOpen={() => {}} />)}
          </TabsContent>

          <TabsContent value="resources" className="grid gap-3 sm:grid-cols-2 mt-4">
            {resources.length === 0 && <div className="sm:col-span-2"><Empty msg="No resources uploaded" /></div>}
            {resources.map((r) => <ResourceCard key={r.id} resource={{ ...r, uploader: profile }} onBuy={() => {}} />)}
          </TabsContent>

          <TabsContent value="certs" className="mt-4">
            <Empty msg="No certifications yet — connect Coursera, ALX, edX to display badges" />
          </TabsContent>

          <TabsContent value="reviews" className="space-y-3 mt-4">
            {reviews.length === 0 && <Empty msg="No reviews yet" />}
            {reviews.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div><p className="text-lg font-bold">{n}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{msg}</div>;
}
// suppress unused
void PostCard;

function FriendActions({ otherId, otherName }: { otherId: string; otherName: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { edges } = useFriendships();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const edge = edges[otherId] ?? null;
  const status = deriveStatus(edge, user.id);

  const wrap = async (fn: () => Promise<void>, errMsg: string) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { toast.error(e?.message ?? errMsg); } finally { setBusy(false); }
  };

  // Auto-open chat once the request is accepted (set when user clicked "Message" on a non-friend)
  useEffect(() => {
    if (status !== "friends") return;
    let flagged = false;
    try { flagged = localStorage.getItem(`auto_open_chat:${otherId}`) === "1"; } catch {}
    if (!flagged) return;
    try { localStorage.removeItem(`auto_open_chat:${otherId}`); } catch {}
    (async () => {
      try {
        const id = await openConversation(user.id, otherId);
        navigate({ to: "/messages", search: { c: id } });
      } catch {}
    })();
  }, [status, otherId, user.id, navigate]);

  if (status === "friends") {
    return (
      <Button size="sm" disabled={busy} onClick={() => wrap(async () => {
        const id = await openConversation(user.id, otherId);
        navigate({ to: "/messages", search: { c: id } });
      }, "Could not open chat")}>
        <MessageCircle className="h-4 w-4" /> Message
      </Button>
    );
  }
  if (status === "outgoing_pending") {
    return (
      <>
        <Button size="sm" variant="outline" disabled><Clock className="h-4 w-4" /> Request sent</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => wrap(async () => { if (edge) await cancelRequest(edge.id); }, "Could not cancel")}>Cancel</Button>
      </>
    );
  }
  if (status === "incoming_pending") {
    return (
      <>
        <Button size="sm" disabled={busy} onClick={() => wrap(async () => { if (edge) await respondToRequest(edge.id, true); toast.success(`Connected with ${otherName}`); }, "Could not accept")}>
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => wrap(async () => { if (edge) await respondToRequest(edge.id, false); }, "Could not decline")}>
          <X className="h-4 w-4" /> Decline
        </Button>
      </>
    );
  }
  return (
    <>
      <Button size="sm" disabled={busy} onClick={() => wrap(async () => {
        await sendFriendRequest(user.id, otherId);
        toast.success(`Friend request sent to ${otherName}`);
      }, "Could not send request")}>
        <UserPlus className="h-4 w-4" /> Connect
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => wrap(async () => {
        await sendFriendRequest(user.id, otherId);
        try { localStorage.setItem(`auto_open_chat:${otherId}`, "1"); } catch {}
        toast.message("Request sent", { description: `We'll open the chat with ${otherName} as soon as they accept.` });
      }, "Could not send request")}>
        <MessageCircle className="h-4 w-4" /> Message
      </Button>
    </>
  );
}
