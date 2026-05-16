import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { FriendEdge } from "@/lib/friends";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

/**
 * Loads all friend_request rows involving the current user, keyed by the OTHER user's id.
 * Subscribes to realtime changes so Connect / Accept actions update both sides instantly.
 */
export function useFriendships() {
  const { user } = useAuth();
  const [edges, setEdges] = useState<Record<string, FriendEdge>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friend_requests")
      .select("id, sender_id, recipient_id, status")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);
    const map: Record<string, FriendEdge> = {};
    (data ?? []).forEach((row) => {
      const other = row.sender_id === user.id ? row.recipient_id : row.sender_id;
      map[other] = row as FriendEdge;
    });
    setEdges(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`friend_requests:${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { edges, loading, refresh: load };
}
