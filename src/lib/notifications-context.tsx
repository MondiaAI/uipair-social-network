import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type Notification = {
  id: string;
  type: string;
  content: string;
  is_read: boolean;
  created_at: string;
  related_id: string | null;
};

type Ctx = {
  items: Notification[];
  unread: number;
  loading: boolean;
  reload: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,type,content,is_read,created_at,related_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    reload();
    const channel = supabase
      .channel(`notifications-shared-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Notification;
          setItems((prev) => prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 50));
          toast(row.content);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Notification;
          setItems((prev) => prev.map((n) => n.id === row.id ? { ...n, ...row } : n));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.old as { id: string };
          setItems((prev) => prev.filter((n) => n.id !== row.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, reload]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }, []);

  const unread = items.reduce((acc, n) => acc + (n.is_read ? 0 : 1), 0);

  return (
    <NotificationsContext.Provider value={{ items, unread, loading, reload, markAllRead, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
