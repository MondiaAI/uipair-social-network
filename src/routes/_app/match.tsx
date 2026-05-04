import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { SUBJECTS } from "@/lib/subjects";
import { MatchCard, type MatchProfile } from "@/components/peerly/MatchCard";
import { IncomingFriendRequests } from "@/components/peerly/IncomingFriendRequests";
import { useFriendships } from "@/hooks/use-friendships";
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
import { ChevronDown, Search } from "lucide-react";

export const Route = createFileRoute("/_app/match")({
  component: MatchPage,
});

const AVAILABILITY_OPTS = ["weekday", "weekend", "evenings"] as const;
type Availability = (typeof AVAILABILITY_OPTS)[number];

interface ProfileRow extends MatchProfile {
  availability: string[] | null;
  country: string | null;
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
  const campusScore = me.university && me.university === other.university ? 15 : 0;

  return Math.round(subjectScore + availScore + yearScore + campusScore);
}

function MatchPage() {
  const { user, profile } = useAuth();
  const { mode } = useFeedMode();
  const { edges } = useFriendships();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1, 6]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university, country, field_of_study, year_of_study, skills, availability, goals, last_seen_at")
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
    return profiles
      .filter((p) => {
        if (mode === "campus" && profile?.university && p.university !== profile.university) return false;
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
      .sort((a, b) => b.score - a.score);
  }, [profiles, me, mode, profile?.university, subjects, availability, yearRange]);

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

      <div className="sticky top-16 z-30 mb-6 rounded-xl border bg-card/95 p-4 shadow-sm backdrop-blur">
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

          <Badge variant="secondary" className="capitalize">{mode}</Badge>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading partners…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No matches yet. Try adjusting your filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ profile: p, score }) => (
            <MatchCard key={p.id} profile={p} score={score} edge={edges[p.id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
