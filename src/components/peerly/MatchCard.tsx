import { useState } from "react";
import { MessageCircle, GraduationCap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MatchScoreRing } from "./MatchScoreRing";
import { StudyTogetherModal } from "./StudyTogetherModal";

export interface MatchProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
  field_of_study: string | null;
  year_of_study: number | null;
  skills: string[] | null;
  goals: string | null;
  last_seen_at: string | null;
}

interface Props {
  profile: MatchProfile;
  score: number;
}

export function MatchCard({ profile, score }: Props) {
  const [open, setOpen] = useState(false);
  const name = profile.full_name || profile.username || "Student";
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const isOnline = profile.last_seen_at
    ? Date.now() - new Date(profile.last_seen_at).getTime() < 5 * 60 * 1000
    : false;

  return (
    <div className="relative rounded-xl border bg-card p-4 shadow-sm">
      <div className="absolute right-4 top-4">
        <MatchScoreRing score={score} />
      </div>
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          )}
        </div>
        <div className="min-w-0 flex-1 pr-12">
          <h3 className="truncate font-semibold">{name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {profile.university || "—"} {profile.year_of_study ? `· Year ${profile.year_of_study}` : ""}
          </p>
          {profile.field_of_study && (
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-primary" />
              {profile.field_of_study}
            </p>
          )}
          {profile.skills && profile.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.skills.slice(0, 5).map((s) => (
                <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}
          {profile.goals && (
            <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">🎯 {profile.goals}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <MessageCircle className="h-4 w-4" /> Message
        </Button>
        <Button size="sm" className="flex-1" onClick={() => setOpen(true)}>
          Study Together
        </Button>
      </div>
      <StudyTogetherModal
        open={open}
        onOpenChange={setOpen}
        partnerId={profile.id}
        partnerName={name}
        defaultSubject={profile.field_of_study ?? undefined}
      />
    </div>
  );
}
