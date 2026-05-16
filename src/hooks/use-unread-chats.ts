import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

/**
 * Counts unread chat messages addressed to the current user across all of
 * their conversations. Subscribes to realtime so the badge updates instantly
 * when a new message arrives or an existing one is marked read.
 */
export function useUnreadChats(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id) { setCount(0); return; }

    let cancelled = false;

    const recount = async () => {
      // 1) All conversations I'm in
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      const ids = (convs ?? []).map((c) => c.id);
      if (ids.length === 0) {
        if (!cancelled) setCount(0);
        return;
      }
      // 2) Count messages in those conversations that aren't from me and aren't read
      const { count: c } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", ids)
        .neq("sender_id", user.id)
        .is("read_at", null);
      if (!cancelled) setCount(c ?? 0);
    };

    recount();

    const channel = supabase
      .channel(uniqueRealtimeChannelName(`unread-chats-${user.id}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => recount())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => recount())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  return count;
}
