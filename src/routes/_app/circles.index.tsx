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
import { useAllSubjects } from "@/lib/use-all-subjects";
import { addCustomSubject } from "@/lib/subjects";
import { DegreeFilterBar, matchesDegree, useSharedDegree, type DegreeKey } from "@/components/peerly/DegreeFilterBar";
import { CustomSubjectFilter, useCustomSubject } from "@/components/peerly/CustomSubjectFilter";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/_app/circles/")({
  component: CirclesPage,
});

interface CircleRow extends CircleCardData {
  university: string | null;
}

function CirclesPage() {
  const allSubjects = useAllSubjects();
  const { user, profile } = useAuth();
  const { mode } = useFeedMode();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [degree, setDegree] = useSharedDegree();
  const [customSubject, setCustomSubject] = useCustomSubject();
  const [inviteInput, setInviteInput] = useState("");

  const handleJoinByInvite = () => {
    const raw = inviteInput.trim();
    if (!raw) return;
    const match = raw.match(/\/invite\/([A-Za-z0-9_-]+)/);
    const token = match ? match[1] : raw.replace(/^\/+|\/+$/g, "");
    if (!token) { toast.error("Invalid invite link or token"); return; }
    navigate({ to: "/invite/$token", params: { token } });
  };
  

  const userUniversity = profile?.university ?? null;

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("circles")
      .select("id,name,subject,custom_subject,description,scope,is_premium,price_monthly,member_count,leader_id,university")
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
        custom_subject: r.custom_subject,
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

  // Realtime: keep joined/subscribed state in sync across cards without refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`circles-membership-${user.id}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "circle_members", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { circle_id: string };
          setMemberships((prev) => new Set(prev).add(row.circle_id));
          setCircles((prev) => prev.map((c) =>
            c.id === row.circle_id ? { ...c, member_count: c.member_count + 1 } : c
          ));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "circle_members", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.old as { circle_id: string };
          setMemberships((prev) => { const n = new Set(prev); n.delete(row.circle_id); return n; });
          setCircles((prev) => prev.map((c) =>
            c.id === row.circle_id ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c
          ));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);


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
      if (subjectFilter !== "all" && subjectFilter !== "Other" && c.subject !== subjectFilter) return false;
      if (subjectFilter === "Other" && customSubject.trim()) {
        if (!c.subject.toLowerCase().includes(customSubject.trim().toLowerCase())) return false;
      }
      if (!matchesDegree(c.subject, degree)) return false;
      if (mode === "campus") {
        if (c.scope !== "campus") return false;
        if (userUniversity && c.university && c.university !== userUniversity) return false;
      } else {
        if (c.scope !== "global") return false;
      }
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
    });
  }, [circles, search, subjectFilter, customSubject, degree, mode, userUniversity]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h1 className="text-2xl font-bold">Study Circles</h1>
        <div className="flex gap-2">
          <Link
            to="/circles/discover"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Compass className="h-4 w-4" /> Discover
          </Link>
          <Link
            to="/circles/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create Circle
          </Link>
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
            {allSubjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {subjectFilter === "Other" && (
        <div className="mb-4">
          <CustomSubjectFilter
            storageKey="circles.index.customSubject"
            value={customSubject}
            onChange={setCustomSubject}
            placeholder="Type your subject (auto-saved)…"
          />
        </div>
      )}

      <div className="mb-6">
        <DegreeFilterBar value={degree} onChange={setDegree} />
      </div>

      <div className="rounded-xl border bg-card p-3 mb-6 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="text-sm font-medium shrink-0">Have an invite?</div>
        <Input
          placeholder="Paste invite link or token…"
          value={inviteInput}
          onChange={(e) => setInviteInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleJoinByInvite(); }}
          className="flex-1"
        />
        <Button onClick={handleJoinByInvite} disabled={!inviteInput.trim()}>Join</Button>
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
    </div>
  );
}
