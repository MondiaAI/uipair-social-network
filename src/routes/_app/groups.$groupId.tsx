import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send, UserPlus, LogOut, Loader2, Users as UsersIcon, Check, Share2, Settings, Copy, Shield, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Linkify } from "@/components/peerly/Linkify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";
import { useFriendships } from "@/hooks/use-friendships";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/groups/$groupId")({
  component: GroupChatPage,
});

type GroupMeta = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  creator_id: string;
  university: string | null;
  requires_approval: boolean;
};

type Member = {
  user_id: string;
  role: "admin" | "member";
  profile: { id: string; full_name: string | null; username: string | null; avatar_url: string | null } | null;
};

type Msg = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function GroupChatPage() {
  const { groupId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupMeta | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const profilesById = useMemo(() => {
    const m = new Map<string, Member["profile"]>();
    members.forEach((mem) => m.set(mem.user_id, mem.profile));
    return m;
  }, [members]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: g, error: gErr }, { data: mems }, { data: msgs }] = await Promise.all([
        supabase.from("group_chats").select("id, name, description, kind, creator_id, university, requires_approval").eq("id", groupId).maybeSingle(),
        supabase.from("group_chat_members").select("user_id, role").eq("group_id", groupId),
        supabase.from("group_chat_messages").select("id, group_id, sender_id, content, created_at").eq("group_id", groupId).order("created_at", { ascending: true }).limit(500),
      ]);
      if (cancelled) return;
      if (gErr || !g) {
        toast.error("Group not found or you're not a member");
        navigate({ to: "/groups" });
        return;
      }
      const userIds = (mems ?? []).map((m: any) => m.user_id);
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", userIds)
        : { data: [] as any };
      const profileMap = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
      if (cancelled) return;
      setGroup(g as GroupMeta);
      setMembers(
        (mems ?? []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          profile: profileMap.get(m.user_id) ?? null,
        })),
      );
      setMessages((msgs ?? []) as Msg[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, user, navigate]);

  // Realtime: subscribe to new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`group-${groupId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_chat_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!user || !group || !profile?.tenant_id) return;
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setInput("");
    const { error } = await supabase.from("group_chat_messages").insert({
      group_id: group.id,
      sender_id: user.id,
      content: text,
      tenant_id: profile.tenant_id,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      setInput(text);
    }
  };

  const leave = async () => {
    if (!user || !group) return;
    if (group.creator_id === user.id) {
      toast.error("Creators can't leave their own group. Delete it instead.");
      return;
    }
    const { error } = await supabase.from("group_chat_members").delete().eq("group_id", group.id).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("You left the group");
    navigate({ to: "/groups" });
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading group…</div>;
  }
  if (!group) return null;

  return (
    <div className="mx-auto max-w-3xl flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between gap-2 border-b p-3 bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/groups"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="font-semibold truncate">{group.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{group.kind} group · {members.length} member{members.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(() => {
            const isAdmin = members.some((m) => m.user_id === user!.id && m.role === "admin");
            const reloadMembers = async () => {
              const { data: mems } = await supabase.from("group_chat_members").select("user_id, role").eq("group_id", group.id);
              const userIds = (mems ?? []).map((m: any) => m.user_id);
              const { data: profs } = userIds.length
                ? await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", userIds)
                : { data: [] as any };
              const pm = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
              setMembers((mems ?? []).map((m: any) => ({ user_id: m.user_id, role: m.role, profile: pm.get(m.user_id) ?? null })));
            };
            return (
              <>
                {isAdmin && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Share invite"><Share2 className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <InvitePanel groupId={group.id} tenantId={profile?.tenant_id ?? null} userId={user!.id} />
                    </DialogContent>
                  </Dialog>
                )}
                {isAdmin && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Group settings"><Settings className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <EditGroupPanel group={group} onSaved={(g) => setGroup(g)} />
                    </DialogContent>
                  </Dialog>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Members"><UsersIcon className="h-4 w-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <MembersPanel
                      groupId={group.id}
                      isAdmin={isAdmin}
                      members={members}
                      onChange={reloadMembers}
                    />
                  </DialogContent>
                </Dialog>
                {group.creator_id !== user!.id && (
                  <Button variant="ghost" size="icon" onClick={leave} aria-label="Leave"><LogOut className="h-4 w-4" /></Button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {group.kind === "alumni" && (
        <div className="border-b bg-card">
          {(() => {
            const isAdmin = members.some((m) => m.user_id === user!.id && m.role === "admin");
            return (
              <>
                {isAdmin && <AlumniJoinRequests groupId={group.id} onApproved={() => {
                  // refresh members after approval
                  supabase.from("group_chat_members").select("user_id, role").eq("group_id", group.id).then(async ({ data: mems }) => {
                    const ids = (mems ?? []).map((m: any) => m.user_id);
                    const { data: profs } = ids.length
                      ? await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", ids)
                      : { data: [] as any };
                    const pm = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
                    setMembers((mems ?? []).map((m: any) => ({ user_id: m.user_id, role: m.role, profile: pm.get(m.user_id) ?? null })));
                  });
                }} />}
                <AlumniFeed university={group.university} />
              </>
            );
          })()}
        </div>
      )}



      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user!.id;
            const p = profilesById.get(m.sender_id);
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback>{(p?.full_name ?? p?.username ?? "?").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                  {!mine && (
                    <p className="text-[10px] font-medium opacity-70 mb-0.5">{p?.full_name ?? p?.username ?? "Unknown"}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words"><Linkify text={m.content} /></p>
                  <p className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-3 bg-card flex items-end gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message"
          maxLength={4000}
        />
        <Button onClick={send} disabled={sending || !input.trim()} size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function MembersPanel({
  groupId,
  isAdmin,
  members,
  onChange,
}: {
  groupId: string;
  isAdmin: boolean;
  members: Member[];
  onChange: () => void;
}) {
  const { user } = useAuth();
  const { edges } = useFriendships();
  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const [adding, setAdding] = useState<string | null>(null);
  const [friendProfiles, setFriendProfiles] = useState<Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }>>([]);

  const friendIds = useMemo(
    () => Object.entries(edges).filter(([, e]) => e.status === "accepted").map(([id]) => id),
    [edges],
  );

  useEffect(() => {
    if (friendIds.length === 0) {
      setFriendProfiles([]);
      return;
    }
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", friendIds)
      .then(({ data }) => setFriendProfiles((data ?? []) as any));
  }, [friendIds]);

  const friendList = useMemo(
    () => friendProfiles.filter((f) => !memberIds.has(f.id)),
    [friendProfiles, memberIds],
  );

  const addFriend = async (friendId: string) => {
    setAdding(friendId);
    const { error } = await supabase.from("group_chat_members").insert({ group_id: groupId, user_id: friendId, role: "member" });
    setAdding(null);
    if (error) return toast.error(error.message);
    toast.success("Added to group");
    onChange();
  };

  const removeMember = async (uid: string) => {
    const { error } = await supabase.from("group_chat_members").delete().eq("group_id", groupId).eq("user_id", uid);
    if (error) return toast.error(error.message);
    onChange();
  };

  const setRole = async (uid: string, role: "admin" | "member") => {
    const { error } = await supabase.from("group_chat_members").update({ role }).eq("group_id", groupId).eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success(role === "admin" ? "Promoted to admin" : "Demoted to member");
    onChange();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Members ({members.length})</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/40">
              <Avatar className="h-8 w-8">
                <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                <AvatarFallback>{(m.profile?.full_name ?? "?").slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.profile?.full_name ?? m.profile?.username ?? "Unknown"}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
              </div>
              {isAdmin && m.user_id !== user?.id && (
                <>
                  {m.role === "admin" ? (
                    <Button size="icon" variant="ghost" onClick={() => setRole(m.user_id, "member")} title="Demote"><ShieldOff className="h-4 w-4" /></Button>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={() => setRole(m.user_id, "admin")} title="Make admin"><Shield className="h-4 w-4" /></Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m.user_id)}>Remove</Button>
                </>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-1"><UserPlus className="h-4 w-4" /> Add from friends</p>
            {friendIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">You have no friends yet. Connect with peers to invite them here.</p>
            ) : friendList.length === 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Check className="h-3 w-3" /> All your friends are already in this group.</p>
            ) : (
              <div className="space-y-1">
                {friendList.map((f: any) => (
                  <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/40">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={f.avatar_url ?? undefined} />
                      <AvatarFallback>{(f.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.full_name ?? f.username}</p>
                    </div>
                    <Button size="sm" onClick={() => addFriend(f.id)} disabled={adding === f.id}>
                      {adding === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!isAdmin && (
          <p className="text-xs text-muted-foreground border-t pt-3">Only admins can add or remove members. Ask an admin for an invite link.</p>
        )}
      </div>
    </>
  );
}

function InvitePanel({ groupId, tenantId, userId }: { groupId: string; tenantId: string | null; userId: string }) {
  const [invites, setInvites] = useState<Array<{ id: string; token: string; is_active: boolean; use_count: number; max_uses: number | null; expires_at: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("group_chat_invites")
      .select("id, token, is_active, use_count, max_uses, expires_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId]);

  const createInvite = async () => {
    if (!tenantId) return toast.error("Set your university first");
    setCreating(true);
    const { error } = await supabase.from("group_chat_invites").insert({ group_id: groupId, tenant_id: tenantId, created_by: userId });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Invite link created");
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("group_chat_invites").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const copy = async (token: string) => {
    const url = `${window.location.origin}/groups/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy. Long-press to copy: " + url);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share invite links</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Button onClick={createInvite} disabled={creating} className="w-full">
          {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
          Create new invite link
        </Button>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-xs text-muted-foreground">No invite links yet. Create one to share.</p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {invites.map((inv) => {
              const url = `${window.location.origin}/groups/invite/${inv.token}`;
              return (
                <div key={inv.id} className="border rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={url} className="text-xs font-mono" />
                    <Button size="icon" variant="outline" onClick={() => copy(inv.token)} disabled={!inv.is_active}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>
                      {inv.is_active ? "Active" : "Revoked"} · used {inv.use_count}
                      {inv.max_uses ? `/${inv.max_uses}` : ""}
                    </span>
                    {inv.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}>Revoke</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function EditGroupPanel({ group, onSaved }: { group: GroupMeta; onSaved: (g: GroupMeta) => void }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    const { data, error } = await supabase
      .from("group_chats")
      .update({ name: name.trim(), description: description.trim() || null })
      .eq("id", group.id)
      .select("id, name, description, kind, creator_id")
      .maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    if (data) onSaved(data as GroupMeta);
    toast.success("Group updated");
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Group settings</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save changes
        </Button>
      </div>
    </>
  );
}
