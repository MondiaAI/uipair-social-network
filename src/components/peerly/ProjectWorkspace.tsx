import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, LayoutGrid, Brain, MessageSquare, Share2, UserPlus, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

type WorkspaceType = "document" | "board" | "mindmap" | "thread";
type WorkspaceStatus = "active" | "draft" | "complete";

interface WorkspaceRow {
  id: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  content: string;
  updated_by: string | null;
  updated_at: string;
}

interface MemberLite {
  user_id: string;
  profile?: { full_name: string | null; username: string | null; avatar_url: string | null };
}

const WORKSPACE_TABS: { value: WorkspaceType; label: string; icon: typeof FileText; placeholder: string }[] = [
  { value: "document", label: "Document", icon: FileText, placeholder: "# Project Brief\n\nStart writing your collaborative document here..." },
  { value: "board", label: "Board", icon: LayoutGrid, placeholder: "Backlog:\n- Idea 1\n\nIn Progress:\n- Idea 2\n\nDone:\n- Idea 3" },
  { value: "mindmap", label: "Mind Map", icon: Brain, placeholder: "Central Idea\n  - Branch 1\n    - Sub-idea\n  - Branch 2" },
  { value: "thread", label: "Thread", icon: MessageSquare, placeholder: "Start a discussion thread..." },
];

const STATUS_STYLES: Record<WorkspaceStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  complete: "bg-blue-100 text-blue-700 border-blue-200",
};

const PRESENCE_COLORS = ["bg-rose-500", "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-pink-500"];

export function ProjectWorkspace({
  projectId,
  members,
  isMember,
  projectName,
}: {
  projectId: string;
  members: MemberLite[];
  isMember: boolean;
  projectName: string;
}) {
  const { user } = useAuth();
  const [activeType, setActiveType] = useState<WorkspaceType>("document");
  const [workspaces, setWorkspaces] = useState<Record<WorkspaceType, WorkspaceRow | null>>({
    document: null, board: null, mindmap: null, thread: null,
  });
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);

  const current = workspaces[activeType];
  const placeholder = WORKSPACE_TABS.find((t) => t.value === activeType)!.placeholder;

  const load = async () => {
    const { data } = await supabase
      .from("project_workspaces")
      .select("*")
      .eq("project_id", projectId);
    const map: Record<WorkspaceType, WorkspaceRow | null> = { document: null, board: null, mindmap: null, thread: null };
    (data ?? []).forEach((w) => { map[w.type as WorkspaceType] = w as WorkspaceRow; });
    setWorkspaces(map);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    setDraft(current?.content ?? "");
  }, [current?.id, activeType]);

  // Realtime presence + content sync
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(uniqueRealtimeChannelName(`workspace:${projectId}`), {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPresentUserIds(Object.keys(state));
      })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "project_workspaces", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?.id]);

  const presenceMembers = useMemo(() => {
    const ids = new Set(presentUserIds);
    return members.filter((m) => ids.has(m.user_id)).slice(0, 6);
  }, [presentUserIds, members]);

  const save = async () => {
    if (!user || !isMember) return;
    setSaving(true);
    if (current) {
      const { error } = await supabase
        .from("project_workspaces")
        .update({ content: draft, updated_by: user.id })
        .eq("id", current.id);
      if (error) toast.error(error.message); else toast.success("Saved");
    } else {
      const { error } = await supabase.from("project_workspaces").insert({
        project_id: projectId, type: activeType, content: draft, updated_by: user.id,
      });
      if (error) toast.error(error.message); else toast.success("Workspace created");
    }
    setSaving(false);
    load();
  };

  const updateStatus = async (status: WorkspaceStatus) => {
    if (!current || !isMember) return;
    const { error } = await supabase.from("project_workspaces").update({ status }).eq("id", current.id);
    if (error) toast.error(error.message); else load();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/lab/${projectId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleInvite = () => {
    toast.info("Invite link copied — send it to your collaborators", { description: `${window.location.origin}/lab/${projectId}` });
    navigator.clipboard?.writeText(`${window.location.origin}/lab/${projectId}`).catch(() => {});
  };

  return (
    <Card className="overflow-hidden">
      {/* Workspace type selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {WORKSPACE_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveType(t.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Presence dots */}
          {presenceMembers.length > 0 && (
            <div className="flex -space-x-2">
              {presenceMembers.map((m, i) => (
                <Avatar key={m.user_id} className={cn("h-7 w-7 border-2 border-background ring-1", PRESENCE_COLORS[i % PRESENCE_COLORS.length].replace("bg-", "ring-"))}>
                  <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(m.profile?.full_name ?? m.profile?.username ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={handleInvite}>
            <UserPlus className="h-4 w-4" /> Invite to Lab
          </Button>
          <Button size="sm" variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </div>

      {/* Workspace content area */}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{projectName} · {WORKSPACE_TABS.find((t) => t.value === activeType)!.label}</h3>
            {current && (
              <Badge variant="outline" className={STATUS_STYLES[current.status]}>
                {current.status === "active" ? "Active" : current.status === "draft" ? "Draft" : "Complete"}
              </Badge>
            )}
          </div>
          {current && (
            <p className="text-xs text-muted-foreground">
              Last edited {formatDistanceToNow(new Date(current.updated_at), { addSuffix: true })}
            </p>
          )}
        </div>

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={14}
          disabled={!isMember}
          className="resize-none font-mono text-sm leading-relaxed"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {current && isMember ? (
            <Select value={current.status} onValueChange={(v) => updateStatus(v as WorkspaceStatus)}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          ) : <span />}
          {isMember ? (
            <Button size="sm" onClick={save} disabled={saving || draft === (current?.content ?? "")}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : current ? "Save changes" : "Create workspace"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Join the project to edit this workspace.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
