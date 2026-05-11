import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Camera, Star, BadgeCheck, GraduationCap, UserPlus, MessageCircle, Check, X, Clock, Send, Loader2, Paperclip, FileIcon, Pencil, Settings as SettingsIcon } from "lucide-react";
import { uploadToBucket } from "@/lib/storage";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { UniversitySelector } from "@/components/peerly/UniversitySelector";

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
  const [editOpen, setEditOpen] = useState(false);

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

  // Realtime: keep this profile page fresh when the owner edits their profile,
  // posts new content, or others follow/unfollow them.
  useEffect(() => {
    const channel = supabase
      .channel(`profile-live-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "gigs", filter: `seller_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
     
  }, [userId]);

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
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {!isMe && user && (
              <>
                <Button size="sm" variant={following ? "outline" : "default"} onClick={toggleFollow}>
                  {following ? "Following" : "Follow"}
                </Button>
                <FriendActions otherId={userId} otherName={name} />
              </>
            )}
            {isMe && (
              <>
                <Button size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit profile
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/settings" })}>
                  <SettingsIcon className="h-4 w-4" /> Settings
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/ambassador" })}>Earn as Ambassador</Button>
              </>
            )}
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

      {isMe && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={profile}
          onSaved={async () => { await refreshProfile(); load(); }}
        />
      )}
    </div>
  );
}

function EditProfileDialog({
  open, onOpenChange, profile, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: any;
  onSaved: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [field, setField] = useState(profile?.field_of_study ?? "");
  const [year, setYear] = useState<string>(profile?.year_of_study?.toString() ?? "");
  const [skills, setSkills] = useState<string>((profile?.skills ?? []).join(", "));
  const [interests, setInterests] = useState<string>((profile?.interests ?? []).join(", "));
  const [universityId, setUniversityId] = useState<string | null>(profile?.university_id ?? null);
  const [universityName, setUniversityName] = useState<string | null>(profile?.university ?? null);
  const [country, setCountry] = useState<string | null>(profile?.country ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(profile?.full_name ?? "");
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
    setField(profile?.field_of_study ?? "");
    setYear(profile?.year_of_study?.toString() ?? "");
    setSkills((profile?.skills ?? []).join(", "));
    setInterests((profile?.interests ?? []).join(", "));
    setUniversityId(profile?.university_id ?? null);
    setUniversityName(profile?.university ?? null);
    setCountry(profile?.country ?? null);
  }, [open, profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const yearNum = year ? parseInt(year, 10) : null;
    const update: any = {
      full_name: fullName.trim() || null,
      username: username.trim() || null,
      bio: bio.trim() || null,
      field_of_study: field.trim() || null,
      year_of_study: Number.isFinite(yearNum as number) ? yearNum : null,
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
      university_id: universityId,
      university: universityName,
      country: country,
    };
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Full name</Label>
            <Input id="ep-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-username">Username</Label>
            <Input id="ep-username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-bio">Bio</Label>
            <Textarea id="ep-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-field">Field of study</Label>
              <Input id="ep-field" value={field} onChange={(e) => setField(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-year">Year</Label>
              <Input id="ep-year" type="number" min={1} max={10} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-skills">Skills (comma-separated)</Label>
            <Input id="ep-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Figma, Python" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-interests">Interests (comma-separated)</Label>
            <Input id="ep-interests" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="AI, Startups, Music" />
          </div>
          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
            <Label className="text-sm">University & country</Label>
            <UniversitySelector
              value={universityId}
              country={country}
              onChange={({ universityId: id, universityName: name, country: c }) => {
                setUniversityId(id);
                setUniversityName(name);
                setCountry(c);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            You can also manage these from{" "}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/settings" });
              }}
              className="underline underline-offset-2 hover:text-foreground font-medium text-primary"
            >
              Settings
            </button>
            .
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <StartConversationButton
        meId={user.id}
        otherId={otherId}
        otherName={otherName}
        onOpened={(id) => navigate({ to: "/messages", search: { c: id } })}
      />
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

function StartConversationButton({
  meId,
  otherId,
  otherName,
  onOpened,
}: {
  meId: string;
  otherId: string;
  otherName: string;
  onOpened: (conversationId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX = 1000;
  const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
  const remaining = MAX - text.length;
  const trimmed = text.trim();
  const canSend = !sending && (trimmed.length > 0 || !!attachment) && text.length <= MAX;

  // Object URL preview for image attachments
  useEffect(() => {
    if (!attachment || !attachment.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(attachment);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  // Subscribe to realtime conversation creation so we navigate even if the
  // conversation was created in another tab/device while this popover is open.
  useEffect(() => {
    if (!open) return;
    const [a, b] = [meId, otherId].sort();
    const channel = supabase
      .channel(`conv-watch-${a}-${b}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `user_a=eq.${a}` },
        (payload: any) => {
          if (payload?.new?.user_b === b) {
            onOpened(payload.new.id as string);
            setOpen(false);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, meId, otherId, onOpened]);

  const pickFile = (file: File | null) => {
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File is too large. Max 20 MB.");
      return;
    }
    setAttachment(file);
  };

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const toastId = toast.loading(
      attachment ? `Uploading & sending to ${otherName}…` : `Sending message to ${otherName}…`
    );
    try {
      const id = await startConversationWithMessage(meId, otherId, trimmed, attachment);
      toast.success(`Message sent to ${otherName}`, { id: toastId });
      setText("");
      setAttachment(null);
      setOpen(false);
      onOpened(id);
    } catch (e: any) {
      const msg = e?.message?.includes("are_friends")
        ? `You can only message ${otherName} after they accept your connect request.`
        : e?.message ?? "Could not send message. Please try again.";
      toast.error(msg, { id: toastId });
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => !sending && setOpen(v)}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <MessageCircle className="h-4 w-4" /> Message
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <div>
          <p className="text-sm font-medium">Start a conversation</p>
          <p className="text-xs text-muted-foreground">Send {otherName} your first message</p>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          placeholder={`Say hi to ${otherName}…`}
          rows={3}
          autoFocus
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />

        {attachment && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
            {previewUrl ? (
              <img src={previewUrl} alt="preview" className="h-10 w-10 rounded object-cover" />
            ) : (
              <FileIcon className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{attachment.name}</p>
              <p className="text-muted-foreground">{(attachment.size / 1024).toFixed(0)} KB</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setAttachment(null)}
              disabled={sending}
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
          onChange={(e) => {
            pickFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Attach file"
              title="Attach a file or image"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <span className={`text-xs ${remaining < 50 ? "text-destructive" : "text-muted-foreground"}`}>
              {remaining} left
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button size="sm" onClick={send} disabled={!canSend}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Press ⌘/Ctrl + Enter to send</p>
      </PopoverContent>
    </Popover>
  );
}
