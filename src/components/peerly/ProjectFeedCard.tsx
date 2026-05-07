import { Rocket, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { toast } from "sonner";
import { FeeBadge } from "@/components/peerly/ProjectCard";

export interface ProjectFeedCardData {
  id: string;
  name: string;
  is_public: boolean;
  join_fee_cents: number;
  fee_interval: "one_time" | "monthly";
  member_count: number;
  team_size_limit: number;
  creator_id: string;
}

export function ProjectFeedCard({
  project,
  isMember,
  onJoined,
}: {
  project: ProjectFeedCardData;
  isMember: boolean;
  onJoined?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);

  const isFull = project.member_count >= project.team_size_limit;
  const isFree = project.join_fee_cents === 0;

  const view = () =>
    navigate({ to: "/lab/$projectId", params: { projectId: project.id } });

  const join = async () => {
    if (!user) return;
    setJoining(true);
    const { error } = await supabase.rpc("join_public_project", { _project_id: project.id });
    setJoining(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Joined ${project.name}!`);
    onJoined?.();
    view();
  };

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="rounded-lg bg-primary/10 p-2">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{project.name}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Users className="h-3 w-3" />
              <span>{project.member_count}/{project.team_size_limit} members</span>
              {!project.is_public && (
                <Badge variant="outline" className="ml-1 text-[10px] py-0">Private</Badge>
              )}
            </div>
          </div>
        </div>
        {project.is_public && (
          <FeeBadge cents={project.join_fee_cents} interval={project.fee_interval} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={view}>
          <ExternalLink className="h-3.5 w-3.5" />
          View
        </Button>
        {project.is_public ? (
          isMember ? (
            <Button size="sm" className="flex-1" variant="secondary" onClick={view}>
              Open
            </Button>
          ) : isFull ? (
            <Button size="sm" className="flex-1" disabled>Full</Button>
          ) : isFree ? (
            <Button size="sm" className="flex-1" onClick={join} disabled={joining || !user}>
              {joining ? "Joining…" : "Join Project"}
            </Button>
          ) : (
            <Button size="sm" className="flex-1" onClick={view}>
              Join · ${(project.join_fee_cents / 100).toFixed(2)}
              {project.fee_interval === "monthly" ? "/mo" : ""}
            </Button>
          )
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1">
                <Button size="sm" className="w-full" disabled>Join</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>This is a private project — you need an invite to join.</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
