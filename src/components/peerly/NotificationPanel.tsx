import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Handshake, MessageSquare, Lightbulb, Package, CheckCircle2, Trophy, Users, Radio, DollarSign, Megaphone, Pin } from "lucide-react";
import { timeAgo } from "@/lib/gig-meta";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

const ICONS: Record<string, { icon: typeof Handshake; color: string }> = {
  partner_request: { icon: Handshake, color: "text-blue-600" },
  comment: { icon: MessageSquare, color: "text-purple-600" },
  reaction: { icon: Lightbulb, color: "text-amber-600" },
  gig_order: { icon: Package, color: "text-emerald-600" },
  gig_completed: { icon: CheckCircle2, color: "text-emerald-600" },
  bounty_claimed: { icon: Trophy, color: "text-yellow-600" },
  circle_member: { icon: Users, color: "text-blue-600" },
  live_session: { icon: Radio, color: "text-rose-600" },
  payment: { icon: DollarSign, color: "text-emerald-600" },
  announcement_new: { icon: Megaphone, color: "text-primary" },
  announcement_pinned: { icon: Pin, color: "text-primary" },
  announcement_updated: { icon: Megaphone, color: "text-primary" },
};

const ANNOUNCEMENT_TYPES = new Set([
  "announcement_new",
  "announcement_pinned",
  "announcement_updated",
]);

type N = {
  id: string;
  type: string;
  content: string;
  is_read: boolean;
  created_at: string;
  related_id: string | null;
};

export function NotificationPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<N[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,type,content,is_read,created_at,related_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as N[]);
    setLoading(false);
  };

  // Mark all unread as read whenever the panel opens.
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      await load();
      const { data: unread } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (unread && unread.length > 0) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("is_read", false);
        setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    })();
  }, [open, user]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = async (n: N) => {
    // Mark this one as read (if it isn't already)
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }

    // Deep-link announcement notifications to the exact item on the circle page.
    if (ANNOUNCEMENT_TYPES.has(n.type) && n.related_id) {
      const { data: ann } = await supabase
        .from("circle_announcements")
        .select("circle_id")
        .eq("id", n.related_id)
        .maybeSingle();
      if (ann?.circle_id) {
        onOpenChange(false);
        navigate({
          to: "/circles/$circleId",
          params: { circleId: ann.circle_id },
          hash: `announcement-${n.related_id}`,
        });
        return;
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="flex-row items-center justify-between space-y-0">
          <SheetTitle>Notifications</SheetTitle>
          <Button variant="ghost" size="sm" onClick={markAll}>Mark all read</Button>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto -mx-6 px-6">
          {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}
          {!loading && items.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="text-xs text-muted-foreground mt-1">No notifications yet</p>
            </div>
          )}
          <ul className="divide-y">
            {items.map((n) => {
              const meta = ICONS[n.type] ?? { icon: Lightbulb, color: "text-muted-foreground" };
              const Icon = meta.icon;
              const clickable = ANNOUNCEMENT_TYPES.has(n.type) && !!n.related_id;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left flex gap-3 py-3 transition-colors",
                      !n.is_read && "bg-accent/30 -mx-2 px-2 rounded",
                      clickable && "hover:bg-accent/40 -mx-2 px-2 rounded cursor-pointer",
                      !clickable && "cursor-default",
                    )}
                  >
                    <div className={cn("mt-0.5", meta.color)}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{n.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
