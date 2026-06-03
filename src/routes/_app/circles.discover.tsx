import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, Sparkles, Users, GraduationCap, Globe, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLocation } from "@/lib/normalize-location";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleCard, type CircleCardData } from "@/components/peerly/CircleCard";
import { SUBJECTS } from "@/lib/subjects";
import { useAllSubjects } from "@/lib/use-all-subjects";
import { addCustomSubject } from "@/lib/subjects";
import { DegreeFilterBar, matchesDegree, useSharedDegree, type DegreeKey } from "@/components/peerly/DegreeFilterBar";
import { CustomSubjectFilter, useCustomSubject } from "@/components/peerly/CustomSubjectFilter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/_app/circles/discover")({
  component: DiscoverCirclesPage,
});

interface CircleRow extends CircleCardData {
  university: string | null;
}

type Tier = "all" | "free" | "premium";
type Scope = "all" | "campus" | "global";

function DiscoverCirclesPage() {
  const allSubjects = useAllSubjects();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [degree, setDegree] = useSharedDegree();
  const [customSubject, setCustomSubject] = useCustomSubject();
  const [tier, setTier] = useState<Tier>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [campusOnlyMine, setCampusOnlyMine] = useState(true);

  const userUniversity = profile?.university ?? null;

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("circles")
      .select("id,name,subject,description,scope,is_premium,price_monthly,member_count,leader_id,university")
      .order("member_count", { ascending: false });

    const leaderIds = Array.from(new Set((rows ?? []).map((r) => r.leader_id)));
    const { data: leaders } = leaderIds.length
      ? await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", leaderIds)
      : { data: [] as Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }> };
    const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l]));

    setCircles((rows ?? []).map((r) => ({
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
    })));

    if (user) {
      const { data: mem } = await supabase
        .from("circle_members").select("circle_id").eq("user_id", user.id);
      setMemberships(new Set((mem ?? []).map((m) => m.circle_id)));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  // Realtime: sync card states when membership changes anywhere.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`discover-membership-${user.id}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "circle_members", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { circle_id: string };
          setMemberships((prev) => new Set(prev).add(row.circle_id));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "circle_members", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.old as { circle_id: string };
          setMemberships((prev) => { const n = new Set(prev); n.delete(row.circle_id); return n; });
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
    setMemberships((prev) => new Set(prev).add(circleId));
    setCircles((prev) => prev.map((c) => c.id === circleId ? { ...c, member_count: c.member_count + 1 } : c));
    const { error } = await supabase.from("circle_members").insert({ circle_id: circleId, user_id: user.id });
    if (error) {
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return circles.filter((c) => {
      if (subjectFilter !== "all" && subjectFilter !== "Other" && c.subject !== subjectFilter) return false;
      if (subjectFilter === "Other" && customSubject.trim()) {
        if (!c.subject.toLowerCase().includes(customSubject.trim().toLowerCase())) return false;
      }
      if (!matchesDegree(c.subject, degree)) return false;
      if (tier === "free" && c.is_premium) return false;
      if (tier === "premium" && !c.is_premium) return false;
      if (scope !== "all" && c.scope !== scope) return false;
      if (scope === "campus" && campusOnlyMine && userUniversity && c.university && c.university !== userUniversity) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q) || c.subject.toLowerCase().includes(q);
    });
  }, [circles, search, subjectFilter, customSubject, degree, tier, scope, campusOnlyMine, userUniversity]);

  const activeFilters = [
    subjectFilter !== "all" && { label: subjectFilter, clear: () => setSubjectFilter("all") },
    degree !== "all" && { label: degree, clear: () => setDegree("all") },
    tier !== "all" && { label: tier === "free" ? "Free" : "Premium", clear: () => setTier("all") },
    scope !== "all" && { label: scope === "campus" ? "Campus" : "Global", clear: () => setScope("all") },
    scope === "campus" && campusOnlyMine && userUniversity && {
      label: `My uni: ${userUniversity}`, clear: () => setCampusOnlyMine(false),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/circles"><ArrowLeft className="h-4 w-4" /> Circles</Link>
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Discover circles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find your tribe — filter by subject, free vs premium, and campus vs global reach.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, subject, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {allSubjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {subjectFilter === "Other" && (
            <div className="sm:col-span-3">
              <CustomSubjectFilter
                storageKey="circles.discover.customSubject"
                value={customSubject}
                onChange={setCustomSubject}
                placeholder="Type your subject (auto-saved)…"
              />
            </div>
          )}

          <div className="flex rounded-md border p-0.5 bg-background">
            {([
              { v: "all", label: "All", icon: null },
              { v: "free", label: "Free", icon: null },
              { v: "premium", label: "Premium", icon: Sparkles },
            ] as const).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setTier(v)}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 rounded text-xs font-medium px-2 py-1.5 transition",
                  tier === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {Icon && <Icon className="h-3 w-3" />} {label}
              </button>
            ))}
          </div>

          <div className="flex rounded-md border p-0.5 bg-background">
            {([
              { v: "all", label: "All", icon: Users },
              { v: "campus", label: "Campus", icon: GraduationCap },
              { v: "global", label: "Global", icon: Globe },
            ] as const).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setScope(v)}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 rounded text-xs font-medium px-2 py-1.5 transition",
                  scope === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
        </div>

        <DegreeFilterBar value={degree} onChange={setDegree} />

        {scope === "campus" && userUniversity && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={campusOnlyMine}
              onChange={(e) => setCampusOnlyMine(e.target.checked)}
              className="rounded border-input"
            />
            Only show circles from my university ({userUniversity})
          </label>
        )}

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activeFilters.map((f) => (
              <Badge key={f.label} variant="secondary" className="gap-1">
                {f.label}
                <button type="button" onClick={f.clear} className="hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <button
              type="button"
              onClick={() => { setSubjectFilter("all"); setTier("all"); setScope("all"); setSearch(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} circle${filtered.length === 1 ? "" : "s"} found`}
        </p>
      </div>

      {loading ? null : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <p>No circles match these filters.</p>
          <p className="mt-1">Try clearing a filter or broadening your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <CircleCard key={c.id} circle={c} joined={memberships.has(c.id)} joining={joiningIds.has(c.id)} onJoin={handleJoin} />
          ))}
        </div>
      )}
    </div>
  );
}
