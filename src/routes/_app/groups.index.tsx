import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Users, BookOpen, MessageSquare, FlaskConical, Briefcase, MoreHorizontal, Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/groups/")({
  component: GroupsPage,
  head: () => ({
    meta: [
      { title: "Groups · UiPair" },
      { name: "description", content: "Create and join study, chat, research and project groups." },
    ],
  }),
});

type GroupKind = "study" | "chat" | "research" | "project" | "alumni" | "other";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  kind: GroupKind;
  creator_id: string;
  last_message_at: string;
  created_at: string;
};

const KIND_META: Record<GroupKind, { label: string; icon: typeof Users; tint: string }> = {
  study: { label: "Study", icon: BookOpen, tint: "bg-blue-500/10 text-blue-600" },
  chat: { label: "Chat", icon: MessageSquare, tint: "bg-emerald-500/10 text-emerald-600" },
  research: { label: "Research", icon: FlaskConical, tint: "bg-purple-500/10 text-purple-600" },
  project: { label: "Project", icon: Briefcase, tint: "bg-amber-500/10 text-amber-600" },
  alumni: { label: "Alumni", icon: GraduationCap, tint: "bg-primary/10 text-primary" },
  other: { label: "Other", icon: MoreHorizontal, tint: "bg-muted text-muted-foreground" },
};

function GroupsPage() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // RLS already scopes to groups where the user is a member.
    const { data, error } = await supabase
      .from("group_chats")
      .select("id, name, description, kind, creator_id, last_message_at, created_at")
      .order("last_message_at", { ascending: false });
    if (error) toast.error(error.message);
    setGroups((data ?? []) as GroupRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || (g.description ?? "").toLowerCase().includes(q));
  }, [groups, search]);

  if (!user) return <div className="p-8 text-center text-muted-foreground">Please sign in.</div>;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-sm text-muted-foreground">Multi-user chats for study, research, projects, or just hanging out.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> New group</Button>
          </DialogTrigger>
          <DialogContent>
            <CreateGroupForm
              tenantId={profile?.tenant_id ?? null}
              userId={user.id}
              onCreated={() => {
                setCreateOpen(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search your groups" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading groups…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No groups yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first study, chat, research or project group.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New group
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => {
            const meta = KIND_META[g.kind] ?? KIND_META.other;
            const Icon = meta.icon;
            return (
              <Link
                key={g.id}
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className="block rounded-xl border bg-card p-4 hover:bg-accent/30 transition"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${meta.tint}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{g.name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                    </div>
                    {g.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{g.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Active {formatDistanceToNow(new Date(g.last_message_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateGroupForm({
  tenantId,
  userId,
  onCreated,
}: {
  tenantId: string | null;
  userId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<GroupKind>("chat");
  const [university, setUniversity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!tenantId) {
      toast.error("Set your university in onboarding before creating a group.");
      return;
    }
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (kind === "alumni" && !university.trim()) {
      toast.error("Pick the university this alumni group is for");
      return;
    }
    setSubmitting(true);
    const finalName =
      kind === "alumni" && !name.toLowerCase().includes("alumni")
        ? `${university.trim()} Alumni — ${name.trim()}`
        : name.trim();
    const finalDesc =
      kind === "alumni"
        ? `${university.trim()} alumni community. ${description.trim()}`.trim()
        : description.trim() || null;
    const { error } = await supabase.from("group_chats").insert({
      name: finalName,
      description: finalDesc,
      kind,
      creator_id: userId,
      tenant_id: tenantId,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Group created");
    onCreated();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New group</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as GroupKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="study">📚 Study</SelectItem>
              <SelectItem value="chat">💬 Chat</SelectItem>
              <SelectItem value="research">🔬 Research</SelectItem>
              <SelectItem value="project">💼 Project</SelectItem>
              <SelectItem value="alumni">🎓 Alumni Community</SelectItem>
              <SelectItem value="other">✨ Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {kind === "alumni" && (
          <div>
            <Label>University</Label>
            <Input
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              maxLength={120}
              placeholder="e.g. University of Rwanda"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Open to graduates of any university — pick the one this community is for.
            </p>
          </div>
        )}
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder={kind === "alumni" ? "e.g. Class of 2020, Engineering Alumni" : "e.g. CS101 Study Squad"}
          />
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
        </div>
        <Button onClick={submit} disabled={submitting || !name.trim()} className="w-full">
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create group
        </Button>
        <p className="text-xs text-muted-foreground">
          You'll be added as admin. Invite others from the group page.
        </p>
      </div>
    </>
  );
}
