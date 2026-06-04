import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Trash2, UploadCloud, Radio, Video as VideoIcon, ExternalLink, Eye, EyeOff } from "lucide-react";

interface CourseVideoRow {
  id: string;
  uploader_id: string;
  title: string;
  description: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  created_at: string;
  is_visible: boolean;
  source_session_id: string | null;
  signedUrl?: string;
}

interface LiveSessionRow {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  room_name: string;
  status: "scheduled" | "live" | "ended";
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

export function ProjectCoursesPanel({ projectId, isMember, isCreator }: { projectId: string; isMember: boolean; isCreator: boolean }) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<CourseVideoRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("course_videos")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []) as CourseVideoRow[];
    const withUrls = await Promise.all(
      rows.map(async (v) => {
        const { data: s } = await supabase.storage.from("course-videos").createSignedUrl(v.storage_path, 60 * 60);
        return { ...v, signedUrl: s?.signedUrl };
      })
    );
    setVideos(withUrls);
  };

  useEffect(() => { void refresh(); }, [projectId]);

  const upload = async () => {
    if (!user || !file || !title.trim()) return;
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Video must be under 500 MB");
      return;
    }
    setUploading(true);
    setProgress(10);
    const timer = setInterval(() => setProgress((p) => (p < 88 ? p + 4 : p)), 400);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-videos")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("course_videos").insert({
        project_id: projectId,
        uploader_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (insErr) throw insErr;
      setProgress(100);
      setTitle(""); setDescription(""); setFile(null);
      toast.success("Course video uploaded");
      void refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      clearInterval(timer);
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  const remove = async (v: CourseVideoRow) => {
    if (!confirm(`Delete "${v.title}"?`)) return;
    const { error } = await supabase.from("course_videos").delete().eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from("course-videos").remove([v.storage_path]).catch(() => {});
    setVideos((prev) => prev.filter((x) => x.id !== v.id));
    toast.success("Deleted");
  };

  if (!isMember) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Course videos are members-only. Join the project to access recorded courses.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Upload a recorded course</h3>
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title (e.g. Week 3 — Linear Regression)" />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this course cover?" rows={2} />
        <Input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="text-xs text-muted-foreground">
            {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
        {uploading && <Progress value={progress} />}
        <div className="flex justify-end">
          <Button onClick={upload} disabled={!file || !title.trim() || uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Max 500 MB. Stored privately — only project members can stream it.</p>
      </Card>

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recorded courses yet.</p>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => {
            const canDelete = v.uploader_id === user?.id || isCreator;
            return (
              <Card key={v.id} className="overflow-hidden">
                {v.signedUrl ? (
                  <video src={v.signedUrl} controls className="w-full aspect-video bg-black" preload="metadata" />
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    <VideoIcon className="h-6 w-6 opacity-50" />
                  </div>
                )}
                <div className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{v.title}</p>
                    {v.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(v.created_at), "PP")}</p>
                  </div>
                  {canDelete && (
                    <Button size="icon" variant="ghost" onClick={() => remove(v)} aria-label="Delete video">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProjectLivePanel({ projectId, isMember }: { projectId: string; isMember: boolean }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<LiveSessionRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setSessions((data ?? []) as LiveSessionRow[]);
  };

  useEffect(() => { void refresh(); }, [projectId]);

  const goLive = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const room = `uipair-live-${projectId.slice(0, 8)}-${Date.now().toString(36)}`;
      const { data, error } = await supabase.from("live_sessions").insert({
        host_id: user.id,
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        room_name: room,
        status: "live",
        started_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      setTitle(""); setDescription("");
      void refresh();
      window.open(`/live/${data.id}`, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Could not start session");
    } finally {
      setCreating(false);
    }
  };

  const endSession = async (s: LiveSessionRow) => {
    const { error } = await supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    void refresh();
  };

  if (!isMember) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Live sessions are members-only.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold">Go live — deliver a course right now</h3>
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" />
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will you cover?" rows={2} />
        <div className="flex justify-end">
          <Button onClick={goLive} disabled={!title.trim() || creating}>
            {creating ? "Starting…" : "Go live"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Streams over your own internet via a built-in video room. Project members can join from the list below.</p>
      </Card>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live sessions yet.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isHost = s.host_id === user?.id;
            return (
              <Card key={s.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{s.title}</p>
                    {s.status === "live" && <Badge variant="destructive" className="gap-1"><Radio className="h-3 w-3 animate-pulse" />LIVE</Badge>}
                    {s.status === "ended" && <Badge variant="secondary">Ended</Badge>}
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {s.status === "live" && s.started_at ? `Started ${formatDistanceToNow(new Date(s.started_at), { addSuffix: true })}` : format(new Date(s.created_at), "PP p")}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {s.status !== "ended" && (
                    <Button size="sm" asChild>
                      <Link to="/live/$sessionId" params={{ sessionId: s.id }} target="_blank">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        {isHost ? "Resume" : "Join"}
                      </Link>
                    </Button>
                  )}
                  {isHost && s.status === "live" && (
                    <Button size="sm" variant="outline" onClick={() => endSession(s)}>End</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
