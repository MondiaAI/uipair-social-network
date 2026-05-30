import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

/** Count of incoming pending friend requests for the current user. */
export function useFriendRequestCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id) { setCount(0); return; }
    let cancelled = false;

    const recount = async () => {
      const { count: c } = await supabase
        .from("friend_requests")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("status", "pending");
      if (!cancelled) setCount(c ?? 0);
    };

    recount();
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`friend-req-count-${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `recipient_id=eq.${user.id}` },
        () => recount(),
      )
      .subscribe();
    const onLocal = () => recount();
    window.addEventListener("friend-requests:changed", onLocal);
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("friend-requests:changed", onLocal);
    };
  }, [user?.id]);

  return count;
}
