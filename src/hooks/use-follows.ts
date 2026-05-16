import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

/**
 * Tracks which users the current user is following. Realtime-aware so the
 * Follow / Unfollow button stays consistent across pages.
 */
export function useFollows() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    setFollowing(new Set((data ?? []).map((r) => r.following_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFollowing(new Set());
      setLoading(false);
      return;
    }
    load();
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`follows:${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const follow = useCallback(
    async (targetId: string) => {
      if (!user) return;
      setFollowing((prev) => new Set(prev).add(targetId));
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetId });
      if (error) {
        setFollowing((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        throw error;
      }
    },
    [user],
  );

  const unfollow = useCallback(
    async (targetId: string) => {
      if (!user) return;
      setFollowing((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);
      if (error) {
        setFollowing((prev) => new Set(prev).add(targetId));
        throw error;
      }
    },
    [user],
  );

  return { following, loading, follow, unfollow };
}
