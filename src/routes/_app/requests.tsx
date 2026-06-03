import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, UserPlus, Inbox, Send } from "lucide-react";
import { respondToRequest, cancelRequest } from "@/lib/friends";
import { toast } from "sonner";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/_app/requests")({
  component: RequestsPage,
});

type ProfileLite = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
  field_of_study: string | null;
};

type RequestRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "canceled";
  created_at: string;
  profile: ProfileLite | null;
};

function RequestsPage() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<RequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: inc }, { data: out }] = await Promise.all([
      supabase
        .from("friend_requests")
        .select("id, sender_id, recipient_id, status, created_at")
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("friend_requests")
        .select("id, sender_id, recipient_id, status, created_at")
        .eq("sender_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const allIds = Array.from(
      new Set([
        ...(inc ?? []).map((r) => r.sender_id),
        ...(out ?? []).map((r) => r.recipient_id),
      ]),
    );

    let byId = new Map<string, ProfileLite>();
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, university, field_of_study")
        .in("id", allIds);
      byId = new Map((profs ?? []).map((p) => [p.id, p as ProfileLite]));
    }

    setIncoming(
      (inc ?? []).map((r) => ({
        ...(r as Omit<RequestRow, "profile">),
        profile: byId.get(r.sender_id) ?? null,
      })),
    );
    setOutgoing(
      (out ?? []).map((r) => ({
        ...(r as Omit<RequestRow, "profile">),
        profile: byId.get(r.recipient_id) ?? null,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`requests-page-${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `recipient_id=eq.${user.id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `sender_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const accept = async (id: string) => {
    setBusyId(id);
    try {
      await respondToRequest(id, true);
      toast.success("Friend request accepted");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept");
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id: string) => {
    setBusyId(id);
    try {
      await respondToRequest(id, false);
      toast.message("Request declined");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not decline");
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await cancelRequest(id);
      toast.message("Request canceled");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not cancel");
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-muted-foreground">
        Sign in to view your friend requests.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserPlus className="h-6 w-6 text-primary" /> Friend requests
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage who wants to connect with you, and track requests you've sent.
        </p>
      </header>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="pending" className="gap-1.5">
            <Inbox className="h-4 w-4" /> Pending
            {incoming.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5">{incoming.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            <Send className="h-4 w-4" /> Sent
            {outgoing.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {outgoing.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : incoming.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-8 w-8 text-muted-foreground" />}
              title="No pending requests"
              hint="When someone wants to connect, you'll see it here."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {incoming.map((r) => (
                <RequestItem
                  key={r.id}
                  row={r}
                  busy={busyId === r.id}
                  primary={{ label: "Accept", icon: Check, onClick: () => accept(r.id) }}
                  secondary={{ label: "Decline", icon: X, onClick: () => decline(r.id) }}
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : outgoing.length === 0 ? (
            <EmptyState
              icon={<Send className="h-8 w-8 text-muted-foreground" />}
              title="No sent requests"
              hint="Requests you send will appear here while they're pending."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {outgoing.map((r) => (
                <RequestItem
                  key={r.id}
                  row={r}
                  busy={busyId === r.id}
                  statusBadge={{ label: "Pending", icon: Clock }}
                  secondary={{ label: "Cancel", icon: X, onClick: () => cancel(r.id) }}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-12 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function RequestItem({
  row,
  busy,
  primary,
  secondary,
  statusBadge,
}: {
  row: RequestRow;
  busy: boolean;
  primary?: { label: string; icon: typeof Check; onClick: () => void };
  secondary?: { label: string; icon: typeof X; onClick: () => void };
  statusBadge?: { label: string; icon: typeof Clock };
}) {
  const name = row.profile?.full_name || row.profile?.username || "Student";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const SubLabel = row.profile?.field_of_study || row.profile?.university || "—";
  const StatusIcon = statusBadge?.icon;

  return (
    <li className="flex items-center gap-3 p-3 sm:p-4">
      <Link
        to="/profile/$userId"
        params={{ userId: row.profile?.id ?? row.sender_id }}
        className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={row.profile?.avatar_url ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{SubLabel}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        {statusBadge && StatusIcon && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <StatusIcon className="h-3 w-3" /> {statusBadge.label}
          </span>
        )}
        {primary && (
          <Button size="sm" disabled={busy} onClick={primary.onClick}>
            <primary.icon className="h-4 w-4" /> {primary.label}
          </Button>
        )}
        {secondary && (
          <Button size="sm" variant="outline" disabled={busy} onClick={secondary.onClick}>
            <secondary.icon className="h-4 w-4" /> {secondary.label}
          </Button>
        )}
      </div>
    </li>
  );
}
