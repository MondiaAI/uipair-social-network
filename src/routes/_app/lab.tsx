import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { CATEGORY_FILTERS, type ProjectCategory, type ProjectRole } from "@/lib/project-meta";
import { CreateProjectModal } from "@/components/peerly/CreateProjectModal";
import { ProjectCard, type ProjectCardData } from "@/components/peerly/ProjectCard";
import { ApplyToProjectModal } from "@/components/peerly/ApplyToProjectModal";
import { HackathonBanner } from "@/components/peerly/HackathonBanner";

export const Route = createFileRoute("/_app/lab")({
  component: LabPage,
});

interface ProjectRow extends ProjectCardData {
  is_public: boolean;
  progress: number;
  updated_at?: string;
}

type MemberAvatar = { full_name: string | null; username: string | null; avatar_url: string | null };


function LabPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
  const [memberAvatars, setMemberAvatars] = useState<Record<string, MemberAvatar[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectCategory | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [applyTo, setApplyTo] = useState<ProjectCardData | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: projectData }, memberQ] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, name, description, subject, category, open_roles, team_size_limit, member_count, deadline, is_public, progress, creator_id",
        )
        .order("created_at", { ascending: false })
        .limit(60),
      user
        ? supabase.from("project_members").select("project_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] as { project_id: string }[] }),
    ]);

    const rows = (projectData ?? []) as Array<ProjectRow & { creator_id: string }>;
    const creatorIds = Array.from(new Set(rows.map((r) => r.creator_id)));
    const { data: profilesData } = creatorIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, university")
          .in("id", creatorIds)
      : { data: [] as { id: string; full_name: string | null; username: string | null; avatar_url: string | null; university: string | null }[] };
    const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));

    setProjects(
      rows.map((r) => ({
        ...r,
        open_roles: (r.open_roles ?? []) as ProjectRole[],
        creator: profileMap.get(r.creator_id) ?? null,
      })),
    );
    setMyProjectIds(new Set(((memberQ.data ?? []) as { project_id: string }[]).map((m) => m.project_id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const myProjects = useMemo(() => projects.filter((p) => myProjectIds.has(p.id)), [projects, myProjectIds]);
  const discover = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (myProjectIds.has(p.id)) return false;
      if (filter !== "all" && p.category !== filter) return false;
      if (term && !p.name.toLowerCase().includes(term) && !(p.description ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [projects, myProjectIds, search, filter]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">The Lab</h1>
          <p className="text-sm text-muted-foreground">Build, brainstorm, and collaborate on projects</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Project
        </Button>
      </header>

      <HackathonBanner />

      {myProjects.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Active Projects</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {myProjects.map((p) => {
              const dl = p.deadline ? new Date(p.deadline) : null;
              return (
                <Link
                  key={p.id}
                  to="/lab/$projectId"
                  params={{ projectId: p.id }}
                  className="block w-[220px] shrink-0"
                >
                  <Card className="h-full p-3 transition hover:shadow-md">
                    <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.subject}</p>
                    <div className="mt-3">
                      <Progress value={p.progress} className="h-1.5" />
                      <p className="mt-1 text-[10px] text-muted-foreground">{p.progress}% · {p.member_count}/{p.team_size_limit}</p>
                    </div>
                    {dl && isValid(dl) && (
                      <p className="mt-2 text-[10px] text-muted-foreground">Due {format(dl, "MMM d")}</p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                filter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading projects…</div>
        ) : discover.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No projects match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {discover.map((p) => (
              <ProjectCard key={p.id} project={p} onApply={setApplyTo} />
            ))}
          </div>
        )}
      </section>

      <CreateProjectModal open={createOpen} onOpenChange={setCreateOpen} />
      <ApplyToProjectModal
        open={!!applyTo}
        onOpenChange={(o) => !o && setApplyTo(null)}
        projectId={applyTo?.id ?? null}
        projectName={applyTo?.name ?? ""}
        defaultRoles={applyTo?.open_roles}
      />
    </div>
  );
}
