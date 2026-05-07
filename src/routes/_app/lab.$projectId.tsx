import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarDays, Eye, Plus, Trash2, Users } from "lucide-react";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { toast } from "sonner";
import { ROLE_CHIP, ROLE_LABEL, type ProjectRole } from "@/lib/project-meta";
import { subjectChipClass } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { ProjectWorkspace } from "@/components/peerly/ProjectWorkspace";

export const Route = createFileRoute("/_app/lab/$projectId")({
  component: ProjectDetailPage,
  validateSearch: (s: Record<string, unknown>) => ({
    action: typeof s.action === "string" ? (s.action as string) : undefined,
  }),
});

interface ProjectDetail {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  subject: string;
  category: string;
  open_roles: ProjectRole[];
  team_size_limit: number;
  member_count: number;
  deadline: string | null;
  is_public: boolean;
  progress: number;
  view_count: number;
  join_fee_cents: number;
}

interface MemberRow {
  user_id: string;
  role: ProjectRole;
  profile?: { full_name: string | null; username: string | null; avatar_url: string | null };
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  position: number;
  user_id: string;
  assignee_id: string | null;
}

interface ActivityRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null; username: string | null; avatar_url: string | null };
}

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null; username: string | null; avatar_url: string | null };
}

interface FileRow {
  id: string;
  title: string;
  url: string;
  file_type: string;
  user_id: string;
  created_at: string;
}

const TASK_COLUMNS: { status: TaskRow["status"]; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

function ProjectDetailPage() {
  const { projectId } = useParams({ from: "/_app/lab/$projectId" });
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newActivity, setNewActivity] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newFileTitle, setNewFileTitle] = useState("");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskRow["status"] | null>(null);

  const isMember = !!user && members.some((m) => m.user_id === user.id);
  const isCreator = !!user && project?.creator_id === user.id;

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (!p) { setLoading(false); return; }
    setProject(p as ProjectDetail);

    const [{ data: m }, { data: t }, { data: a }, { data: c }, { data: f }] = await Promise.all([
      supabase.from("project_members").select("user_id, role").eq("project_id", projectId),
      supabase.from("project_tasks").select("*").eq("project_id", projectId).order("position"),
      supabase.from("project_activity").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(40),
      supabase.from("project_comments").select("*").eq("project_id", projectId).order("created_at").limit(100),
      supabase.from("project_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);

    const userIds = new Set<string>();
    (m ?? []).forEach((x) => userIds.add(x.user_id));
    (a ?? []).forEach((x) => userIds.add(x.user_id));
    (c ?? []).forEach((x) => userIds.add(x.user_id));
    (t ?? []).forEach((x) => { if (x.assignee_id) userIds.add(x.assignee_id); });

    const { data: profiles } = userIds.size
      ? await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", Array.from(userIds))
      : { data: [] as Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }> };
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    setMembers((m ?? []).map((x) => ({ ...x, profile: pMap.get(x.user_id) })) as MemberRow[]);
    setTasks((t ?? []) as TaskRow[]);
    setActivity((a ?? []).map((x) => ({ ...x, profile: pMap.get(x.user_id) })) as ActivityRow[]);
    setComments((c ?? []).map((x) => ({ ...x, profile: pMap.get(x.user_id) })) as CommentRow[]);
    setFiles((f ?? []) as FileRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Increment view counter (fire-and-forget)
    supabase.rpc("increment_project_view", { _project_id: projectId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-join when arriving with ?action=join on a free public project
  useEffect(() => {
    if (search.action !== "join" || !user || !project) return;
    if (isMember) {
      navigate({ to: "/lab/$projectId", params: { projectId }, search: {} });
      return;
    }
    if (!project.is_public || project.join_fee_cents > 0) return;
    if (project.member_count >= project.team_size_limit) return;
    (async () => {
      const { error } = await supabase.rpc("join_public_project", { _project_id: projectId });
      if (error) { toast.error(error.message); return; }
      toast.success(`Joined ${project.name}!`);
      navigate({ to: "/lab/$projectId", params: { projectId }, search: {} });
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.action, user, project?.id, isMember]);

  const postActivity = async () => {
    if (!user || !newActivity.trim()) return;
    const { error } = await supabase.from("project_activity").insert({
      project_id: projectId, user_id: user.id, content: newActivity.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewActivity("");
    load();
  };

  const postComment = async () => {
    if (!user || !newComment.trim()) return;
    const { error } = await supabase.from("project_comments").insert({
      project_id: projectId, user_id: user.id, content: newComment.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    load();
  };

  const addTask = async () => {
    if (!user || !newTaskTitle.trim()) return;
    const { error } = await supabase.from("project_tasks").insert({
      project_id: projectId, user_id: user.id, title: newTaskTitle.trim(), status: "todo",
      position: tasks.filter((t) => t.status === "todo").length,
    });
    if (error) { toast.error(error.message); return; }
    setNewTaskTitle("");
    load();
  };

  const moveTask = async (id: string, status: TaskRow["status"]) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    const { error } = await supabase.from("project_tasks").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const updateAssignee = async (id: string, assigneeId: string | null) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, assignee_id: assigneeId } : t)));
    const { error } = await supabase.from("project_tasks").update({ assignee_id: assigneeId }).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const deleteTask = async (id: string) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await supabase.from("project_tasks").delete().eq("id", id);
  };

  const addFile = async () => {
    if (!user || !newFileTitle.trim() || !newFileUrl.trim()) return;
    const { error } = await supabase.from("project_files").insert({
      project_id: projectId, user_id: user.id, title: newFileTitle.trim(), url: newFileUrl.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewFileTitle(""); setNewFileUrl("");
    load();
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!project) return <div className="py-12 text-center text-muted-foreground">Project not found.</div>;

  const dl = project.deadline ? new Date(project.deadline) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <Link to="/lab" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Lab
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Badge variant="outline" className={subjectChipClass(project.subject)}>{project.subject}</Badge>
              <Badge variant="secondary">{project.category}</Badge>
              {!project.is_public && <Badge variant="outline">Private</Badge>}
            </div>
            {project.description && <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{project.member_count}/{project.team_size_limit}</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{project.view_count ?? 0} views</span>
              {dl && isValid(dl) && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Due {format(dl, "PP")}</span>}
            </div>
            {project.open_roles?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {project.open_roles.map((r) => (
                  <Badge key={r} variant="outline" className={ROLE_CHIP[r]}>Need: {ROLE_LABEL[r]}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="w-44">
            <p className="mb-1 text-xs text-muted-foreground">Progress {project.progress}%</p>
            <Progress value={project.progress} />
          </div>
        </div>
      </Card>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <ProjectWorkspace
            projectId={projectId}
            members={members}
            isMember={isMember}
            projectName={project.name}
          />
        </TabsContent>


        <TabsContent value="activity" className="space-y-3">
          {isMember && (
            <Card className="p-3">
              <Textarea value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Share an update…" rows={2} />
              <div className="mt-2 flex justify-end"><Button size="sm" onClick={postActivity} disabled={!newActivity.trim()}>Post update</Button></div>
            </Card>
          )}
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            activity.map((a) => (
              <Card key={a.id} className="flex gap-3 p-3">
                <Avatar className="h-8 w-8"><AvatarImage src={a.profile?.avatar_url ?? undefined} /><AvatarFallback>{(a.profile?.full_name ?? "?").slice(0, 2)}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{a.profile?.full_name || a.profile?.username}</span>
                    {" · "}{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{a.content}</p>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          {isMember && (
            <Card className="flex gap-2 p-3">
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="New task title…" />
              <Button onClick={addTask} disabled={!newTaskTitle.trim()}><Plus className="h-4 w-4" />Add</Button>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">Tip: drag a task card between columns to update its status.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TASK_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => { if (isMember) { e.preventDefault(); setDragOverCol(col.status); } }}
                  onDragLeave={() => setDragOverCol((c) => (c === col.status ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    if (!isMember || !draggingId) return;
                    const t = tasks.find((x) => x.id === draggingId);
                    if (t && t.status !== col.status) moveTask(draggingId, col.status);
                    setDraggingId(null);
                  }}
                  className={cn(
                    "rounded-lg bg-muted/40 p-3 transition",
                    dragOverCol === col.status && "ring-2 ring-primary/60 bg-primary/5",
                  )}
                >
                  <h3 className="mb-2 text-sm font-semibold">
                    {col.label} <span className="text-muted-foreground">({colTasks.length})</span>
                  </h3>
                  <div className="space-y-2 min-h-[40px]">
                    {colTasks.map((t) => {
                      const assignee = members.find((m) => m.user_id === t.assignee_id)?.profile;
                      return (
                        <Card
                          key={t.id}
                          draggable={isMember}
                          onDragStart={() => setDraggingId(t.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                          className={cn(
                            "p-2.5 cursor-grab active:cursor-grabbing transition",
                            draggingId === t.id && "opacity-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm">{t.title}</p>
                            {isMember && (
                              <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {isMember ? (
                              <Select
                                value={t.assignee_id ?? "unassigned"}
                                onValueChange={(v) => updateAssignee(t.id, v === "unassigned" ? null : v)}
                              >
                                <SelectTrigger className="h-7 px-1.5 gap-1.5 border-0 bg-transparent hover:bg-accent w-auto min-w-0 max-w-[140px]">
                                  {assignee ? (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={assignee.avatar_url ?? undefined} />
                                        <AvatarFallback className="text-[9px]">
                                          {(assignee.full_name ?? assignee.username ?? "?").slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {assignee.full_name || assignee.username}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">Unassigned</span>
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {members.map((m) => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                      {m.profile?.full_name || m.profile?.username || "Member"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : assignee ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={assignee.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[9px]">
                                    {(assignee.full_name ?? assignee.username ?? "?").slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-xs text-muted-foreground">
                                  {assignee.full_name || assignee.username}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Unassigned</span>
                            )}
                            {isMember && (
                              <Select value={t.status} onValueChange={(v) => moveTask(t.id, v as TaskRow["status"])}>
                                <SelectTrigger className="h-6 w-[110px] text-[11px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {TASK_COLUMNS.map((c) => <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground">Drop tasks here</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-3">
          {isMember && (
            <Card className="space-y-2 p-3">
              <Input value={newFileTitle} onChange={(e) => setNewFileTitle(e.target.value)} placeholder="File title" />
              <div className="flex gap-2">
                <Input value={newFileUrl} onChange={(e) => setNewFileUrl(e.target.value)} placeholder="https://…" />
                <Button onClick={addFile} disabled={!newFileTitle.trim() || !newFileUrl.trim()}>Add</Button>
              </div>
            </Card>
          )}
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <Card key={f.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(f.created_at), "PP")}</p>
                  </div>
                  <Button asChild size="sm" variant="outline"><a href={f.url} target="_blank" rel="noreferrer">Open</a></Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discussion" className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            comments.map((c) => (
              <Card key={c.id} className="flex gap-3 p-3">
                <Avatar className="h-8 w-8"><AvatarImage src={c.profile?.avatar_url ?? undefined} /><AvatarFallback>{(c.profile?.full_name ?? "?").slice(0, 2)}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.profile?.full_name || c.profile?.username}</span>
                    {" · "}{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                </div>
              </Card>
            ))
          )}
          {isMember && (
            <Card className="p-3">
              <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Join the discussion…" rows={2} />
              <div className="mt-2 flex justify-end"><Button size="sm" onClick={postComment} disabled={!newComment.trim()}>Comment</Button></div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="members">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {members.map((m) => (
              <Card key={m.user_id} className={cn("flex flex-col items-center gap-2 p-3 text-center", m.user_id === project.creator_id && "ring-1 ring-primary")}>
                <Avatar className="h-12 w-12"><AvatarImage src={m.profile?.avatar_url ?? undefined} /><AvatarFallback>{(m.profile?.full_name ?? "?").slice(0, 2)}</AvatarFallback></Avatar>
                <p className="line-clamp-1 text-sm font-medium">{m.profile?.full_name || m.profile?.username}</p>
                <Badge variant="outline" className={ROLE_CHIP[m.role] ?? ""}>{ROLE_LABEL[m.role] ?? m.role}</Badge>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {isCreator && <p className="text-center text-xs text-muted-foreground">You are the creator of this project.</p>}
    </div>
  );
}
