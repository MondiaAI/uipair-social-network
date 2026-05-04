import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@tanstack/react-router";
import { ROLE_CHIP, ROLE_LABEL, type ProjectRole } from "@/lib/project-meta";
import { subjectChipClass } from "@/lib/subjects";
import { CalendarDays, Users } from "lucide-react";
import { format, isValid } from "date-fns";

export interface ProjectCardData {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  category: string;
  open_roles: ProjectRole[];
  team_size_limit: number;
  member_count: number;
  deadline: string | null;
  creator?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    university: string | null;
  } | null;
}

export function ProjectCard({ project, onApply }: { project: ProjectCardData; onApply?: (p: ProjectCardData) => void }) {
  const deadlineDate = project.deadline ? new Date(project.deadline) : null;
  const initials = (project.creator?.full_name || project.creator?.username || "?").slice(0, 2).toUpperCase();

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/lab/$projectId"
          params={{ projectId: project.id }}
          className="text-base font-semibold leading-tight hover:underline"
        >
          {project.name}
        </Link>
        <Badge variant="outline" className={subjectChipClass(project.subject)}>
          {project.subject}
        </Badge>
      </div>

      {project.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="h-6 w-6">
          <AvatarImage src={project.creator?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <span className="truncate">
          {project.creator?.full_name || project.creator?.username || "Unknown"}
          {project.creator?.university && ` · ${project.creator.university}`}
        </span>
      </div>

      {project.open_roles?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.open_roles.map((r) => (
            <Badge key={r} variant="outline" className={ROLE_CHIP[r]}>
              {ROLE_LABEL[r]}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {project.member_count}/{project.team_size_limit} filled
        </span>
        {deadlineDate && isValid(deadlineDate) && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(deadlineDate, "MMM d")}
          </span>
        )}
      </div>

      {onApply && (
        <Button size="sm" className="w-full" onClick={() => onApply(project)}>
          Apply to Join
        </Button>
      )}
    </Card>
  );
}
