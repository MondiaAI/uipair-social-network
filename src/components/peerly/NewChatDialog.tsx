import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFriendships } from "@/hooks/use-friendships";
import { openConversation } from "@/lib/friends";
import { useNavigate } from "@tanstack/react-router";
import { Search, MessageSquarePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PersonRow {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function NewChatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const { edges } = useFriendships();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<PersonRow[]>([]);
  const [results, setResults] = useState<PersonRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  // Load friends (accepted edges)
  useEffect(() => {
    if (!open || !user) return;
    const friendIds = Object.entries(edges)
      .filter(([, e]) => e.status === "accepted")
      .map(([id]) => id);
    if (friendIds.length === 0) { setFriends([]); return; }
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", friendIds)
      .then(({ data }) => setFriends((data ?? []) as PersonRow[]));
  }, [open, user, edges]);

  // Search profiles by name/username
  useEffect(() => {
    if (!open || !user) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancel = false;
    setBusy(true);
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq("id", user.id)
      .limit(20)
      .then(({ data }) => {
        if (!cancel) { setResults((data ?? []) as PersonRow[]); setBusy(false); }
      });
    return () => { cancel = true; };
  }, [query, open, user]);

  const list = useMemo(() => {
    if (query.trim().length >= 2) return results;
    return friends;
  }, [query, results, friends]);

  const start = async (otherId: string) => {
    if (!user) return;
    setOpening(otherId);
    try {
      const id = await openConversation(user.id, otherId);
      onOpenChange(false);
      setQuery("");
      navigate({ to: "/messages", search: { c: id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start chat");
    } finally {
      setOpening(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" /> Start a new chat
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search students by name or username…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-2">
          {query.trim().length < 2 && friends.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              You don't have any connections yet. Search above for any student to start a chat.
            </p>
          )}
          {query.trim().length >= 2 && busy && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {query.trim().length >= 2 && !busy && list.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No students found.</p>
          )}
          {list.length > 0 && (
            <>
              {query.trim().length < 2 && (
                <p className="px-4 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Your connections
                </p>
              )}
              <div className="space-y-0.5">
                {list.map((p) => {
                  const name = p.full_name || p.username || "Student";
                  const initials = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={p.id}
                      onClick={() => start(p.id)}
                      disabled={opening === p.id}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent disabled:opacity-50"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        {p.username && <p className="truncate text-xs text-muted-foreground">@{p.username}</p>}
                      </div>
                      {opening === p.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
