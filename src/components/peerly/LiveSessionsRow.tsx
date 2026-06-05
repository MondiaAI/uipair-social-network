import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye, Radio } from "lucide-react";
import { useDataLight } from "@/lib/data-light";

interface LiveSession {
  id: string;
  user_id: string;
  content: string;
  view_count: number;
  media_url: string | null;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
}

export function LiveSessionsRow() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [active, setActive] = useState<LiveSession | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, content, view_count, media_url, profiles!posts_user_id_fkey(username, full_name, avatar_url)")
        .eq("is_live_session", true)
        .order("view_count", { ascending: false })
        .limit(10);
      setSessions((data ?? []) as unknown as LiveSession[]);
    })();
  }, []);

  if (sessions.length === 0) return null;

  return (
    <>
      <div className="rounded-2xl border bg-card p-3">
        <div className="flex items-center gap-2 px-1 pb-2 text-xs font-semibold text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-destructive" />
          LIVE STUDY SESSIONS
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {sessions.map((s) => {
            const initials = (s.profiles?.full_name || s.profiles?.username || "?")
              .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
            return (
              <button
                key={s.id}
                onClick={() => setActive(s)}
                className="flex w-16 shrink-0 flex-col items-center gap-1 group"
              >
                <div className="relative">
                  <div className="rounded-full p-[2.5px] bg-gradient-to-tr from-purple-500 to-blue-500">
                    <div className="rounded-full bg-card p-[2px]">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={s.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-destructive px-1.5 py-px text-[9px] font-bold leading-none text-destructive-foreground">
                    LIVE
                  </span>
                </div>
                <span className="mt-1 max-w-full truncate text-[11px] text-muted-foreground group-hover:text-foreground">
                  @{s.profiles?.username ?? "user"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.content.slice(0, 80) || "Live Study Session"}</DialogTitle>
                <DialogDescription className="flex items-center gap-3 pt-1">
                  <span>@{active.profiles?.username}</span>
                  <span className="flex items-center gap-1 text-xs">
                    <Eye className="h-3.5 w-3.5" /> {active.view_count} watching
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  className={cn("w-full")}
                  onClick={() => active.media_url && window.open(active.media_url, "_blank")}
                  disabled={!active.media_url}
                >
                  Join Session
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
