import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { SUBJECTS } from "@/lib/subjects";
import { MatchCard, type MatchProfile } from "@/components/peerly/MatchCard";
import { IncomingFriendRequests } from "@/components/peerly/IncomingFriendRequests";
import { NewMembersRow } from "@/components/peerly/NewMembersRow";
import { useFriendships } from "@/hooks/use-friendships";
import { useMatchDismissals } from "@/hooks/use-match-dismissals";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Search, History, Check, Clock, X, GraduationCap, Globe2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/match")({
  component: MatchPage,
});

const AVAILABILITY_OPTS = ["weekday", "weekend", "evenings"] as const;
type Availability = (typeof AVAILABILITY_OPTS)[number];
type SortKey = "best" | "newest" | "active";

interface ProfileRow extends MatchProfile {
  availability: string[] | null;
  country: string | null;
  created_at?: string | null;
  university_id?: string | null;
}

function computeScore(me: ProfileRow, other: ProfileRow): number {
  const mySubjects = new Set([me.field_of_study, ...(me.skills ?? [])].filter(Boolean) as string[]);
  const otherSubjects = new Set([other.field_of_study, ...(other.skills ?? [])].filter(Boolean) as string[]);
  let shared = 0;
  mySubjects.forEach((s) => { if (otherSubjects.has(s)) shared++; });
  const subjectScore = Math.min(shared, 1) * 40;

  const myAvail = new Set(me.availability ?? []);
  const otherAvail = new Set(other.availability ?? []);
  let availOverlap = 0;
  myAvail.forEach((a) => { if (otherAvail.has(a)) availOverlap++; });
  const availScore = Math.min(availOverlap / Math.max(myAvail.size, 1), 1) * 30;

  const yearScore = me.year_of_study && me.year_of_study === other.year_of_study ? 15 : 0;
  const sameUniversity =
    (me.university_id && other.university_id && me.university_id === other.university_id) ||
    (!!me.university && me.university === other.university);
  const campusScore = sameUniversity ? 15 : 0;

  return Math.round(subjectScore + availScore + yearScore + campusScore);
}

function MatchPage() {
  const { user, profile } = useAuth();
  const { mode, setMode } = useFeedMode();
  const { edges } = useFriendships();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1, 6]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("best");
  const { hidden, dismiss, restore, restoreAll } = useMatchDismissals();

  const handleNotAMatch = async (id: string) => {
    const target = profiles.find((p) => p.id === id);
    const name = target?.full_name || target?.username || "this student";
    await dismiss(id);
    toast.success("Thanks — we'll improve your matches", {
      description: `${name} won't be suggested again.`,
      action: {
        label: "Undo",
        onClick: () => {
          restore(id).catch(() => toast.error("Could not restore"));
        },
      },
    });
  };

  const SORT_LABELS: Record<SortKey, string> = {
    best: "Best match",
    newest: "Newest",
    active: "Most active",
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university, country, field_of_study, year_of_study, skills, availability, goals, last_seen_at, created_at")
        .neq("id", user.id)
        .limit(100);
      setProfiles((data ?? []) as ProfileRow[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const me = useMemo<ProfileRow | null>(() => {
    if (!profile) return null;
    return {
      ...profile,
      skills: (profile as any).skills ?? [],
      availability: (profile as any).availability ?? [],
      goals: (profile as any).goals ?? null,
      last_seen_at: (profile as any).last_seen_at ?? null,
    };
  }, [profile]);

  const filtered = useMemo(() => {
    if (!me) return [];
    const q = query.trim().toLowerCase();
    return profiles
      .filter((p) => !hidden.has(p.id))
      .filter((p) => {
        if (mode === "campus" && profile?.university && p.university !== profile.university) return false;
        if (q) {
          const hay = [p.full_name, p.username, p.university, p.country]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (subjects.length > 0) {
          const pSubs = [p.field_of_study, ...(p.skills ?? [])].filter(Boolean) as string[];
          if (!pSubs.some((s) => subjects.includes(s))) return false;
        }
        if (availability.length > 0) {
          const pa = p.availability ?? [];
          if (!availability.some((a) => pa.includes(a))) return false;
        }
        if (p.year_of_study != null) {
          if (p.year_of_study < yearRange[0] || p.year_of_study > yearRange[1]) return false;
        }
        return true;
      })
      .map((p) => ({ profile: p, score: computeScore(me, p) }))
      .sort((a, b) => {
        if (sortKey === "newest") {
          const ta = a.profile.created_at ? new Date(a.profile.created_at).getTime() : 0;
          const tb = b.profile.created_at ? new Date(b.profile.created_at).getTime() : 0;
          return tb - ta;
        }
        if (sortKey === "active") {
          const ta = a.profile.last_seen_at ? new Date(a.profile.last_seen_at).getTime() : 0;
          const tb = b.profile.last_seen_at ? new Date(b.profile.last_seen_at).getTime() : 0;
          return tb - ta;
        }
        return b.score - a.score;
      });
  }, [profiles, me, mode, profile?.university, subjects, availability, yearRange, query, sortKey, hidden]);

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const toggleAvail = (a: Availability) =>
    setAvailability((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Find Your Study Partner</h1>
        <p className="text-sm text-muted-foreground">Matched by subject, availability & goals</p>
      </header>

      <IncomingFriendRequests />

      <div className="mb-4">
        <NewMembersRow title="Just joined UiPair" />
      </div>

      <div className="sticky top-16 z-30 mb-6 rounded-xl border bg-card/95 p-4 shadow-sm backdrop-blur">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, university or country…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Subjects {subjects.length > 0 && <Badge className="ml-1">{subjects.length}</Badge>}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-h-72 w-64 overflow-auto">
              <div className="space-y-1">
                {SUBJECTS.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-accent">
                    <Checkbox checked={subjects.includes(s)} onCheckedChange={() => toggleSubject(s)} />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-3 rounded-md border px-3 py-1.5">
            {AVAILABILITY_OPTS.map((a) => (
              <label key={a} className="flex cursor-pointer items-center gap-1.5 text-xs capitalize">
                <Checkbox checked={availability.includes(a)} onCheckedChange={() => toggleAvail(a)} />
                {a}
              </label>
            ))}
          </div>

          <div className="flex min-w-[180px] flex-1 items-center gap-3">
            <Label className="whitespace-nowrap text-xs">
              Year {yearRange[0]}–{yearRange[1]}
            </Label>
            <Slider
              min={1}
              max={6}
              step={1}
              value={yearRange}
              onValueChange={(v) => setYearRange([v[0], v[1]] as [number, number])}
              className="flex-1"
            />
          </div>

          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best">Best match</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="active">Most active</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="capitalize">{mode}</Badge>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {loading ? "Loading…" : (
            <>
              <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "match" : "matches"}
              {hidden.size > 0 && (
                <>
                  {" "}·{" "}
                  <button
                    className="underline-offset-2 hover:underline"
                    onClick={() => {
                      restoreAll().catch(() => toast.error("Could not restore"));
                    }}
                  >
                    Restore {hidden.size} hidden
                  </button>
                </>
              )}
            </>
          )}
        </p>
        <Badge variant="outline" className="gap-1">
          Sorted by <span className="font-semibold">{SORT_LABELS[sortKey]}</span>
        </Badge>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading partners…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No matches yet. Try adjusting your filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ profile: p, score }) => (
            <MatchCard key={p.id} profile={p} score={score} edge={edges[p.id] ?? null} onNotAMatch={handleNotAMatch} />
          ))}
        </div>
      )}

      {!loading && Object.keys(edges).length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Match history</h2>
          </div>
          <div className="rounded-xl border bg-card divide-y">
            {Object.entries(edges).map(([otherId, edge]) => {
              const p = profiles.find((x) => x.id === otherId);
              if (!p) return null;
              const name = p.full_name || p.username || "Student";
              const init = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
              const isOutgoing = edge.sender_id === user?.id;
              const meta =
                edge.status === "accepted"
                  ? { label: "Connected", cls: "text-emerald-600", Icon: Check }
                  : edge.status === "pending"
                  ? { label: isOutgoing ? "Request sent" : "Request received", cls: "text-amber-600", Icon: Clock }
                  : { label: "Declined", cls: "text-muted-foreground", Icon: X };
              const MetaIcon = meta.Icon;
              return (
                <Link
                  key={otherId}
                  to="/profile/$userId"
                  params={{ userId: otherId }}
                  className="flex items-center gap-3 p-3 hover:bg-accent/40 transition"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{init}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.field_of_study || p.university || "—"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.cls}`}>
                    <MetaIcon className="h-3.5 w-3.5" /> {meta.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
