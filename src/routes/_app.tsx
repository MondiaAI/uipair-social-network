import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/peerly/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    // Check the current session locally first. Only redirect to /login when
    // we are certain there is no session — a transient network/command
    // failure must NOT auto-log the user out.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw redirect({ to: "/login" });
      }
    } catch (e: any) {
      // Re-throw redirects; swallow network errors so the user stays signed in.
      if (e && typeof e === "object" && "to" in e) throw e;
      console.error("[_app beforeLoad] session check failed", e);
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
