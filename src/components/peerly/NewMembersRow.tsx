import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";

interface NewMember {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
  field_of_study: string | null;
  created_at: string;
}

interface Props {
  /** Optional title override */
  title?: string;
  /** Limit number of members shown */
  limit?: number;
  /** Respect campus/global toggle from FeedContext */
  scoped?: boolean;
}

export function NewMembersRow({ title = "New on Peerly", limit = 12, scoped = true }: Props) {
  const { user, profile } = useAuth();
  const { mode } = useFeedMode();
  const [members, setMembers] = useState<NewMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university, field_of_study, created_at")
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (scoped && mode === "campus" && profile?.university) {
        q = q.eq("university", profile.university);
      }
      const { data } = await q;
      const filtered = (data ?? []).filter((m) => m.id !== user?.id).slice(0, limit);
      setMembers(filtered as NewMember[]);
      setLoading(false);
    };
    load();
  }, [user?.id, profile?.university, mode, limit, scoped]);

  if (!loading && members.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {title}
        </h2>
        <Link to="/match" className="text-xs text-primary hover:underline">
          See all
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {members.map((m) => {
            const name = m.full_name || m.username || "Student";
            const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Link
                key={m.id}
                to="/profile/$userId"
                params={{ userId: m.id }}
                className="group flex w-28 shrink-0 flex-col items-center rounded-lg border bg-background p-3 text-center transition hover:shadow-md"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <p className="mt-2 line-clamp-1 w-full text-xs font-semibold group-hover:text-primary">
                  {name}
                </p>
                <p className="line-clamp-1 w-full text-[10px] text-muted-foreground">
                  {m.field_of_study || m.university || "New member"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
