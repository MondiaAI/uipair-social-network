import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/peerly/AppShell";
import { useAuth } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    // Local session check only — fast, no network round-trip.
    // A transient failure must NOT auto-log the user out.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw redirect({ to: "/login" });
      }
    } catch (e: any) {
      if (e && typeof e === "object" && "to" in e) throw e;
      console.error("[_app beforeLoad] session check failed", e);
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  // Only block rendering when we don't yet know the user. Once user is set,
  // render the shell immediately and let individual sections show skeletons.
  if (loading && !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  return (
    <NotificationsProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </NotificationsProvider>
  );
}
