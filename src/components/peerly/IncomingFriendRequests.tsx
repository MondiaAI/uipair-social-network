import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { respondToRequest } from "@/lib/friends";
import { toast } from "sonner";

interface IncomingRow {
  id: string;
  sender_id: string;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    university: string | null;
  } | null;
}

export function IncomingFriendRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<IncomingRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("friend_requests")
        .select("id, sender_id")
        .eq("recipient_id", user.id)
        .eq("status", "pending");
      const list = data ?? [];
      if (list.length === 0) {
        setRows([]);
        return;
      }
      const ids = list.map((r) => r.sender_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      setRows(
        list.map((r) => ({
          id: r.id,
          sender_id: r.sender_id,
          profile: (byId.get(r.sender_id) as IncomingRow["profile"]) ?? null,
        }))
      );
    };
    load();
    const channel = supabase
      .channel(`incoming_requests:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `recipient_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (rows.length === 0) return null;

  const respond = async (id: string, accept: boolean) => {
    try {
      await respondToRequest(id, accept);
      if (accept) toast.success("Friend request accepted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">
        Friend requests <span className="text-muted-foreground">({rows.length})</span>
      </h2>
      <div className="space-y-2">
        {rows.map((r) => {
          const name = r.profile?.full_name || r.profile?.username || "Student";
          const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={r.id} className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.profile?.university || "—"}</p>
              </div>
              <Button size="sm" onClick={() => respond(r.id, true)}>
                <Check className="h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond(r.id, false)}>
                <X className="h-4 w-4" /> Decline
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
