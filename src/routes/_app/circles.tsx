import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, GraduationCap, Globe, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleCard, type CircleCardData } from "@/components/peerly/CircleCard";

import { NewMembersRow } from "@/components/peerly/NewMembersRow";
import { SUBJECTS } from "@/lib/subjects";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/circles")({
  component: CirclesPage,
});

interface CircleRow extends CircleCardData {
  university: string | null;
}

function CirclesPage() {
  const { user, profile } = useAuth();
  const { mode } = useFeedMode();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const userUniversity = profile?.university ?? null;

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("circles")
      .select("id,name,subject,description,scope,is_premium,price_monthly,member_count,leader_id,university")
      .order("created_at", { ascending: false });

    const leaderIds = Array.from(new Set((rows ?? []).map((r) => r.leader_id)));
    const { data: leaders } = leaderIds.length
      ? await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", leaderIds)
      : { data: [] as Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }> };
    const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l]));

    setCircles(
      (rows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        subject: r.subject,
        description: r.description,
        scope: r.scope as "campus" | "global",
        is_premium: r.is_premium,
        price_monthly: r.price_monthly as number | null,
        member_count: r.member_count,
        university: r.university,
        leader: leaderMap.get(r.leader_id) ?? null,
      })),
    );

    if (user) {
      const { data: mem } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user.id);
      setMemberships(new Set((mem ?? []).map((m) => m.circle_id)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleJoin = async (circleId: string) => {
    if (!user) return;
    if (joiningIds.has(circleId) || memberships.has(circleId)) return;
    const circle = circles.find((c) => c.id === circleId);
    if (circle?.is_premium) {
      navigate({ to: "/circles/$circleId", params: { circleId } });
      return;
    }
    setJoiningIds((p) => new Set(p).add(circleId));
    // Optimistic update
    setMemberships((prev) => new Set(prev).add(circleId));
    setCircles((prev) => prev.map((c) => c.id === circleId ? { ...c, member_count: c.member_count + 1 } : c));
    const { error } = await supabase.from("circle_members").insert({ circle_id: circleId, user_id: user.id });
    if (error) {
      // Rollback
      setMemberships((prev) => { const n = new Set(prev); n.delete(circleId); return n; });
      setCircles((prev) => prev.map((c) => c.id === circleId ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c));
      setJoiningIds((p) => { const n = new Set(p); n.delete(circleId); return n; });
      toast.error(error.message || "Failed to join circle");
      return;
    }
    setJoiningIds((p) => { const n = new Set(p); n.delete(circleId); return n; });
    toast.success("Joined circle!");
    navigate({ to: "/circles/$circleId", params: { circleId } });
  };

  const myCircles = useMemo(() => circles.filter((c) => memberships.has(c.id)), [circles, memberships]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return circles.filter((c) => {
      if (subjectFilter !== "all" && c.subject !== subjectFilter) return false;
      if (mode === "campus") {
        if (c.scope !== "campus") return false;
        if (userUniversity && c.university && c.university !== userUniversity) return false;
      } else {
        if (c.scope !== "global") return false;
      }
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
    });
  }, [circles, search, subjectFilter, mode, userUniversity]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h1 className="text-2xl font-bold">Study Circles</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/circles/discover"><Compass className="h-4 w-4" /> Discover</Link>
          </Button>
          <Button asChild>
            <Link to="/circles/new"><Plus className="h-4 w-4" /> Create Circle</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search circles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6">
        <NewMembersRow title="New students to connect with" />
      </div>

      {myCircles.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">My Circles</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {myCircles.map((c) => (
              <div key={c.id} className="shrink-0 w-72 snap-start">
                <CircleCard circle={c} joined={true} onJoin={handleJoin} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Discover</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {mode === "campus" ? (
              <><GraduationCap className="h-3.5 w-3.5" /> Campus{userUniversity ? ` · ${userUniversity}` : ""}</>
            ) : (
              <><Globe className="h-3.5 w-3.5" /> Global circles</>
            )}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading circles…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {mode === "campus" ? (
              <p>
                No campus circles{userUniversity ? ` for ${userUniversity}` : ""} yet.
                {" "}Switch to <span className="font-medium">Global</span> in the header or create one.
              </p>
            ) : (
              <p>No global circles match your filters. Be the first to create one!</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <CircleCard key={c.id} circle={c} joined={memberships.has(c.id)} joining={joiningIds.has(c.id)} onJoin={handleJoin} />
            ))}
          </div>
        )}
      </section>

      <CreateCircleModal open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) load(); }} />
    </div>
  );
}
