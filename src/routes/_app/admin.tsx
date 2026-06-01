import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getMyAdminTenants,
  listTenantJoinRequests,
  approveTenantJoinRequest,
  declineTenantJoinRequest,
  listTenantCircles,
  listCircleMembers,
  removeCircleMember,
  globalFeed,
} from "@/serverFns/admin.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Check, X, Users, Globe2, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

type AdminTenant = {
  tenant_id: string;
  role: string;
  id?: string;
  name?: string;
  slug?: string;
  logo_url?: string | null;
  primary_color?: string | null;
};

function AdminPage() {
  const [tenants, setTenants] = useState<AdminTenant[] | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { tenants } = await getMyAdminTenants();
        setTenants(tenants as AdminTenant[]);
        if (tenants.length > 0) setActiveTenantId(tenants[0].tenant_id);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load admin tenants");
        setTenants([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading admin tools…</div>;
  }
  if (!tenants || tenants.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Admin tools</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are not a moderator for any university yet. Contact your university lead
          to be added as an admin.
        </p>
        <Link to="/feed" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to feed
        </Link>
      </div>
    );
  }

  const activeTenant = tenants.find((t) => t.tenant_id === activeTenantId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" /> Admin dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Moderate university memberships, circles, and the global feed.
          </p>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ""}
            onChange={(e) => setActiveTenantId(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {tenants.map((t) => (
              <option key={t.tenant_id} value={t.tenant_id}>{t.name ?? t.slug ?? t.tenant_id}</option>
            ))}
          </select>
        )}
      </header>

      {activeTenant && (
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
          {activeTenant.logo_url ? (
            <img src={activeTenant.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-md bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{activeTenant.name}</p>
            <p className="text-xs text-muted-foreground truncate">/{activeTenant.slug}</p>
          </div>
          <Badge variant="secondary" className="capitalize">{activeTenant.role}</Badge>
        </div>
      )}

      {activeTenantId && (
        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">Join requests</TabsTrigger>
            <TabsTrigger value="circles">Circles</TabsTrigger>
            <TabsTrigger value="global">Global feed</TabsTrigger>
          </TabsList>
          <TabsContent value="requests" className="mt-4">
            <JoinRequestsPanel tenantId={activeTenantId} />
          </TabsContent>
          <TabsContent value="circles" className="mt-4">
            <CirclesPanel tenantId={activeTenantId} />
          </TabsContent>
          <TabsContent value="global" className="mt-4">
            <GlobalFeedPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------- Join requests ----------
type JoinRequest = {
  id: string;
  user_id: string;
  status: string;
  note: string | null;
  created_at: string;
  profiles?: { id: string; full_name: string | null; username: string | null; avatar_url: string | null } | null;
};

function JoinRequestsPanel({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<JoinRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setItems(null);
    try {
      const { requests } = await listTenantJoinRequests({ data: { tenantId, status: "pending" } });
      setItems(requests as unknown as JoinRequest[]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load requests");
      setItems([]);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenantId]);

  const act = async (id: string, action: "approve" | "decline") => {
    setBusy(id);
    try {
      if (action === "approve") await approveTenantJoinRequest({ data: { requestId: id } });
      else await declineTenantJoinRequest({ data: { requestId: id } });
      setItems((prev) => (prev ?? []).filter((r) => r.id !== id));
      toast.success(action === "approve" ? "Approved" : "Declined");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  if (items === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No pending join requests.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((r) => {
        const name = r.profiles?.full_name || r.profiles?.username || "Student";
        const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div key={r.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={r.profiles?.avatar_url ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">
                Requested {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                {r.note ? ` · "${r.note}"` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => act(r.id, "approve")}
                disabled={busy === r.id}
                className="gap-1"
              >
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => act(r.id, "decline")}
                disabled={busy === r.id}
                className="gap-1"
              >
                <X className="h-4 w-4" /> Decline
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Circles ----------
type AdminCircle = {
  id: string;
  name: string;
  subject: string;
  kind: string;
  is_premium: boolean;
  member_count: number;
  leader_id: string;
  profiles?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
};

type CircleMember = {
  user_id: string;
  role: string;
  joined_at: string;
  profiles?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
};

function CirclesPanel({ tenantId }: { tenantId: string }) {
  const [circles, setCircles] = useState<AdminCircle[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, CircleMember[] | "loading">>({});

  useEffect(() => {
    (async () => {
      try {
        const { circles } = await listTenantCircles({ data: { tenantId } });
        setCircles(circles as unknown as AdminCircle[]);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load circles");
        setCircles([]);
      }
    })();
  }, [tenantId]);

  const loadMembers = async (circleId: string) => {
    setMembers((p) => ({ ...p, [circleId]: "loading" }));
    try {
      const { members } = await listCircleMembers({ data: { circleId } });
      setMembers((p) => ({ ...p, [circleId]: members as unknown as CircleMember[] }));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load members");
      setMembers((p) => ({ ...p, [circleId]: [] }));
    }
  };

  const toggleOpen = (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!members[id]) loadMembers(id);
  };

  const remove = async (circleId: string, userId: string) => {
    if (!confirm("Remove this member from the circle?")) return;
    try {
      await removeCircleMember({ data: { circleId, userId } });
      setMembers((p) => ({
        ...p,
        [circleId]: (p[circleId] === "loading" ? [] : (p[circleId] ?? [])).filter((m) => m.user_id !== userId),
      }));
      setCircles((prev) => (prev ?? []).map((c) => c.id === circleId ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c));
      toast.success("Member removed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove member");
    }
  };

  if (circles === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (circles.length === 0) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No circles yet.</div>;
  }
  return (
    <div className="space-y-2">
      {circles.map((c) => {
        const open = openId === c.id;
        const m = members[c.id];
        return (
          <div key={c.id} className="rounded-xl border bg-card">
            <button
              onClick={() => toggleOpen(c.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/40 rounded-xl"
            >
              <Users className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.subject} · {c.kind === "social" ? "Social club" : "Study circle"}{c.is_premium ? " · Premium" : ""}
                </p>
              </div>
              <Badge variant="secondary">{c.member_count} members</Badge>
            </button>
            {open && (
              <div className="border-t p-3">
                {m === "loading" || !m ? (
                  <p className="text-xs text-muted-foreground">Loading members…</p>
                ) : m.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No members.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {m.map((mem) => {
                      const name = mem.profiles?.full_name || mem.profiles?.username || "Student";
                      const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                      const isLeader = mem.user_id === c.leader_id;
                      return (
                        <li key={mem.user_id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40">
                          <Avatar className="h-7 w-7"><AvatarImage src={mem.profiles?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{initials}</AvatarFallback></Avatar>
                          <span className="text-sm truncate flex-1">{name}</span>
                          {isLeader ? (
                            <Badge variant="outline" className="text-[10px]">Leader</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => remove(c.id, mem.user_id)}
                              title="Remove from circle"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Global feed ----------
type GlobalPost = {
  id: string;
  content: string;
  post_type: string;
  created_at: string;
  university: string | null;
  profiles?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
  tenants?: { name: string | null; slug: string | null; logo_url: string | null } | null;
};

function GlobalFeedPanel() {
  const [posts, setPosts] = useState<GlobalPost[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { posts } = await globalFeed({ data: { limit: 50 } });
      setPosts(posts as unknown as GlobalPost[]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load global feed");
      setPosts([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (posts === null) return <p className="text-sm text-muted-foreground">Loading global feed…</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Globe2 className="h-3.5 w-3.5" /> Cross-tenant posts (admin view)
        </p>
        <Button size="sm" variant="outline" onClick={load} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {posts.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No posts.</div>
      ) : (
        posts.map((p) => {
          const name = p.profiles?.full_name || p.profiles?.username || "Student";
          const initials = name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
          return (
            <article key={p.id} className="rounded-xl border bg-card p-3">
              <header className="flex items-center gap-2.5 mb-2">
                <Avatar className="h-9 w-9"><AvatarImage src={p.profiles?.avatar_url ?? undefined} /><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.tenants?.name ?? "Unknown university"} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize text-[10px]">{p.post_type}</Badge>
              </header>
              <p className="text-sm whitespace-pre-wrap break-words">{p.content}</p>
            </article>
          );
        })
      )}
    </div>
  );
}
