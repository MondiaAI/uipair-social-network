import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { JitsiCall } from "@/components/peerly/JitsiCall";
import { ArrowLeft, Radio, Circle, StopCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/live/$sessionId")({
  component: LiveSessionPage,
});

interface SessionRow {
  id: string;
  host_id: string;
  project_id: string | null;
  circle_id: string | null;
  title: string;
  description: string | null;
  room_name: string;
  status: "scheduled" | "live" | "ended";
}

function LiveSessionPage() {
  const { sessionId } = useParams({ from: "/_app/live/$sessionId" });
  const { user } = useAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("id, host_id, project_id, circle_id, title, description, room_name, status")
        .eq("id", sessionId)
        .single();
      if (error) setError(error.message);
      else setSession(data as SessionRow);
      setLoading(false);
    })();
  }, [sessionId]);

  const isHost = user?.id === session?.host_id;

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const uploadRecording = async (blob: Blob): Promise<void> => {
    if (!session || !user || !session.project_id) {
      toast.message("Recording saved locally — only project sessions auto-upload to Courses");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${session?.title ?? "session"}.webm`; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${session.project_id}/${Date.now()}-live-${session.id.slice(0, 8)}.webm`;
      const { error: upErr } = await supabase.storage
        .from("course-videos")
        .upload(path, blob, { contentType: "video/webm", upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("course_videos").insert({
        project_id: session.project_id,
        uploader_id: user.id,
        title: `${session.title} — recording`,
        description: session.description,
        storage_path: path,
        mime_type: "video/webm",
        size_bytes: blob.size,
        source_session_id: session.id,
        is_visible: false,
      });
      if (insErr) throw insErr;
      toast.success("Recording saved as draft in Lab → Courses. Publish it when you're ready.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not upload recording");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as MediaTrackConstraints,
        audio: true,
      });
      // Mix in microphone audio if available
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch { /* mic optional */ }

      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        chunksRef.current = [];
        stopTracks();
        setRecording(false);
        if (blob.size > 0) await uploadRecording(blob);
      };
      // Stop automatically if user ends screen share from browser UI
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      });
      rec.start(2000);
      recorderRef.current = rec;
      setRecording(true);
      toast.success("Recording started — share this tab for best results");
    } catch (e: any) {
      toast.error(e.message ?? "Could not start recording");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    } else {
      stopTracks();
      setRecording(false);
    }
  };

  const endSession = async () => {
    if (!session) return;
    if (recording) stopRecording();
    await supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    setSession({ ...session, status: "ended" });
  };

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
      stopTracks();
    };
  }, []);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading session…</div>;
  if (error || !session) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error ?? "Session not found or you don't have access."}</p>
        <Button asChild variant="outline" size="sm"><Link to="/lab">Back to Lab</Link></Button>
      </div>
    );
  }

  if (session.status === "ended") {
    return (
      <div className="p-8 text-center space-y-3">
        <Badge variant="secondary">Session ended</Badge>
        <h1 className="text-xl font-semibold">{session.title}</h1>
        {uploading && <p className="text-xs text-muted-foreground">Uploading recording…</p>}
        <Button asChild variant="outline" size="sm"><Link to="/lab">Back to Lab</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild size="icon" variant="ghost"><Link to="/lab"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <Radio className="h-4 w-4 text-destructive animate-pulse" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{session.title}</p>
            {session.description && <p className="text-[11px] text-muted-foreground truncate">{session.description}</p>}
          </div>
          {recording && (
            <Badge variant="destructive" className="gap-1 ml-2">
              <Circle className="h-2.5 w-2.5 fill-current animate-pulse" />REC
            </Badge>
          )}
        </div>
        {isHost && (
          <div className="flex items-center gap-2">
            {session.project_id && (
              recording ? (
                <Button size="sm" variant="outline" onClick={stopRecording}>
                  <StopCircle className="h-4 w-4 mr-1" />Stop recording
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={startRecording} disabled={uploading}>
                  <Circle className="h-4 w-4 mr-1 fill-destructive text-destructive" />
                  {uploading ? "Uploading…" : "Record"}
                </Button>
              )
            )}
            <Button size="sm" variant="destructive" onClick={endSession}>End session</Button>
          </div>
        )}
      </header>
      <div className="flex-1 min-h-0">
        <JitsiCall
          roomName={session.room_name}
          displayName={user?.email ?? "Student"}
        />
      </div>
    </div>
  );
}
