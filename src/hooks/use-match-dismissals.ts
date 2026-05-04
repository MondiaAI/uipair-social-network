import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const LOCAL_KEY = "match:not_a_match";

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Hides student profiles the user has marked "not a match".
 * Persists to Supabase (per-user) so dismissals follow the user across devices.
 * Falls back to localStorage when signed out and migrates legacy entries on login.
 */
export function useMatchDismissals() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(readLocal()));
  const [loading, setLoading] = useState(true);

  // Initial server load + migrate any legacy local entries.
  useEffect(() => {
    if (!user) {
      setHidden(new Set(readLocal()));
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const legacy = readLocal();
      if (legacy.length > 0) {
        await supabase
          .from("match_dismissals")
          .upsert(
            legacy.map((id) => ({ user_id: user.id, dismissed_id: id })),
            { onConflict: "user_id,dismissed_id" },
          );
        try { localStorage.removeItem(LOCAL_KEY); } catch {}
      }
      const { data } = await supabase
        .from("match_dismissals")
        .select("dismissed_id")
        .eq("user_id", user.id);
      setHidden(new Set((data ?? []).map((r) => r.dismissed_id)));
      setLoading(false);
    })();
  }, [user]);

  const dismiss = useCallback(
    async (profileId: string) => {
      setHidden((prev) => new Set(prev).add(profileId));
      if (user) {
        await supabase
          .from("match_dismissals")
          .upsert({ user_id: user.id, dismissed_id: profileId }, { onConflict: "user_id,dismissed_id" });
      } else {
        const next = Array.from(new Set([...readLocal(), profileId]));
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch {}
      }
    },
    [user],
  );

  const restore = useCallback(
    async (profileId: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      if (user) {
        await supabase
          .from("match_dismissals")
          .delete()
          .eq("user_id", user.id)
          .eq("dismissed_id", profileId);
      } else {
        const next = readLocal().filter((id) => id !== profileId);
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch {}
      }
    },
    [user],
  );

  const restoreAll = useCallback(async () => {
    setHidden(new Set());
    if (user) {
      await supabase.from("match_dismissals").delete().eq("user_id", user.id);
    } else {
      try { localStorage.removeItem(LOCAL_KEY); } catch {}
    }
  }, [user]);

  return { hidden, loading, dismiss, restore, restoreAll };
}
