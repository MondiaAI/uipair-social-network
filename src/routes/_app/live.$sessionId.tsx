import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { JitsiCall } from "@/components/peerly/JitsiCall";
import { ArrowLeft, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/live/$sessionId")({
  component: LiveSessionPage,
});

interface SessionRow {
  id: string;
  host_id: string;
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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("id, host_id, title, description, room_name, status")
        .eq("id", sessionId)
        .single();
      if (error) setError(error.message);
      else setSession(data as SessionRow);
      setLoading(false);
    })();
  }, [sessionId]);

  const endSession = async () => {
    if (!session) return;
    await supabase
      .from("live_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    setSession({ ...session, status: "ended" });
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading session…</div>;
  if (error || !session) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error ?? "Session not found or you don't have access."}</p>
        <Button asChild variant="outline" size="sm"><Link to="/lab">Back to Lab</Link></Button>
      </div>
    );
  }

  const isHost = user?.id === session.host_id;

  if (session.status === "ended") {
    return (
      <div className="p-8 text-center space-y-3">
        <Badge variant="secondary">Session ended</Badge>
        <h1 className="text-xl font-semibold">{session.title}</h1>
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
        </div>
        {isHost && (
          <Button size="sm" variant="destructive" onClick={endSession}>End session</Button>
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
