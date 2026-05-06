import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface NetworkPerson {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
  sources: Set<"follow" | "friend" | "circle">;
}

/**
 * Aggregates users from the current user's network: people they follow,
 * accepted friends, and co-members of their study circles. Used to populate
 * teammate pickers (e.g. when creating a project).
 */
export function useNetworkPeople() {
  const { user } = useAuth();
  const [people, setPeople] = useState<NetworkPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPeople([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ids = new Map<string, Set<"follow" | "friend" | "circle">>();
      const add = (id: string, src: "follow" | "friend" | "circle") => {
        if (!id || id === user.id) return;
        if (!ids.has(id)) ids.set(id, new Set());
        ids.get(id)!.add(src);
      };

      const [follows, friends, myCircles] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase
          .from("friend_requests")
          .select("sender_id, recipient_id, status")
          .eq("status", "accepted")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),
        supabase.from("circle_members").select("circle_id").eq("user_id", user.id),
      ]);

      (follows.data ?? []).forEach((r: any) => add(r.following_id, "follow"));
      (friends.data ?? []).forEach((r: any) =>
        add(r.sender_id === user.id ? r.recipient_id : r.sender_id, "friend"),
      );

      const circleIds = (myCircles.data ?? []).map((r: any) => r.circle_id);
      if (circleIds.length) {
        const { data: cm } = await supabase
          .from("circle_members")
          .select("user_id")
          .in("circle_id", circleIds);
        (cm ?? []).forEach((r: any) => add(r.user_id, "circle"));
      }

      const allIds = Array.from(ids.keys());
      if (!allIds.length) {
        if (!cancelled) {
          setPeople([]);
          setLoading(false);
        }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university")
        .in("id", allIds);
      if (cancelled) return;
      const list: NetworkPerson[] = (profs ?? []).map((p: any) => ({
        ...p,
        sources: ids.get(p.id) ?? new Set(),
      }));
      list.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
      setPeople(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { people, loading };
}
