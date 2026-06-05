import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Timer, Play, Square, Trophy, Flame, GraduationCap, Globe2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/deep-work")({
  component: DeepWorkPage,
});

type LeaderRow = {
  user_id: string;
  total: number;
  profile: { full_name: string | null; username: string | null; avatar_url: string | null; university: string | null; is_verified: boolean | null } | null;
};

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function fmtShort(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function DeepWorkPage() {
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState("");
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [scope, setScope] = useState<"campus" | "global">("campus");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const tickRef = useRef<number | null>(null);

  // tick
  useEffect(() => {
    if (!running || !startedAt) return;
    tickRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, startedAt]);

  const loadLeaderboard = async () => {
    if (!user) return;
    // This week (since Monday)
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 0=Mon
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - dow);

    let q = supabase
      .from("study_sessions")
      .select("user_id, duration_seconds, tenant_id")
      .gte("started_at", monday.toISOString())
      .gt("duration_seconds", 0);

    if (scope === "campus" && profile?.tenant_id) {
      q = q.eq("tenant_id", profile.tenant_id);
    }

    const { data: sessions, error } = await q.limit(2000);
    if (error) return;

    const totals = new Map<string, number>();
    for (const s of sessions ?? []) {
      totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + (s.duration_seconds ?? 0));
    }
    setMyTotal(totals.get(user.id) ?? 0);

    const top = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);

    const ids = top.map(([id]) => id);
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, university, is_verified")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    setRows(
      top.map(([id, total]) => ({
        user_id: id,
        total,
        profile: (byId.get(id) as any) ?? null,
      })),
    );
  };

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.tenant_id, scope]);

  const start = () => {
    setStartedAt(Date.now());
    setElapsed(0);
    setRunning(true);
  };

  const stop = async () => {
    if (!user || !startedAt) return;
    const duration = Math.floor((Date.now() - startedAt) / 1000);
    setRunning(false);
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (duration < 30) {
      toast.error("Session too short to log (under 30s)");
      setStartedAt(null);
      setElapsed(0);
      return;
    }
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      subject: subject.trim() || null,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
    });
    setStartedAt(null);
    setElapsed(0);
    if (error) return toast.error(error.message);
    toast.success(`Logged ${fmtShort(duration)} of deep work`);
    loadLeaderboard();
  };

  const myRank = useMemo(() => {
    const idx = rows.findIndex((r) => r.user_id === user?.id);
    return idx >= 0 ? idx + 1 : null;
  }, [rows, user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-primary text-white mb-2">
          <Flame className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">Deep Work</h1>
        <p className="mt-1 text-muted-foreground">
          Focus sessions with weekly leaderboards. Beat your campus, beat the world.
        </p>
      </div>

      {/* Timer */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <p className="font-semibold">Focus timer</p>
        </div>
        <div className="text-center font-mono text-5xl tabular-nums tracking-tight">
          {fmt(elapsed)}
        </div>
        <Input
          placeholder="What are you working on? (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={running}
        />
        {running ? (
          <Button onClick={stop} variant="destructive" className="w-full">
            <Square className="h-4 w-4 mr-2" /> Stop & log
          </Button>
        ) : (
          <Button onClick={start} className="w-full">
            <Play className="h-4 w-4 mr-2" /> Start deep work
          </Button>
        )}
      </Card>

      {/* Leaderboard */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <p className="font-semibold">This week's leaderboard</p>
          </div>
          {myRank && <Badge variant="outline">You're #{myRank} · {fmtShort(myTotal)}</Badge>}
        </div>

        <Tabs value={scope} onValueChange={(v) => setScope(v as "campus" | "global")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="campus"><GraduationCap className="h-4 w-4 mr-1" /> Campus</TabsTrigger>
            <TabsTrigger value="global"><Globe2 className="h-4 w-4 mr-1" /> Global</TabsTrigger>
          </TabsList>
          <TabsContent value={scope} className="mt-4 space-y-2">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No sessions yet this week. Be the first.
              </p>
            ) : (
              rows.map((r, i) => {
                const name = r.profile?.full_name || r.profile?.username || "Student";
                const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <div key={r.user_id} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="w-6 text-center text-sm font-semibold text-muted-foreground">
                      {medal ?? `#${i + 1}`}
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.profile?.avatar_url ?? undefined} alt={name} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {r.profile?.is_verified && (
                          <span className="text-emerald-500" title="Verified student">✓</span>
                        )}
                      </div>
                      {r.profile?.university && (
                        <p className="text-xs text-muted-foreground truncate">{r.profile.university}</p>
                      )}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{fmtShort(r.total)}</div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
