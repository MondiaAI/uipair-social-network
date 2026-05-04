import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Handshake, MessageSquare, Lightbulb, Package, CheckCircle2, Trophy, Users, Radio, DollarSign } from "lucide-react";
import { timeAgo } from "@/lib/gig-meta";
import { cn } from "@/lib/utils";

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
};

type N = { id: string; type: string; content: string; is_read: boolean; created_at: string };

export function NotificationPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,type,content,is_read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as N[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, user]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
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
              return (
                <li key={n.id} className={cn("flex gap-3 py-3", !n.is_read && "bg-accent/30 -mx-2 px-2 rounded")}>
                  <div className={cn("mt-0.5", meta.color)}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{n.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
