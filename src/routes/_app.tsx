import { createFileRoute, redirect, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/peerly/AppShell";
import { useAuth } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw redirect({ to: "/login" });
      }
    } catch (e: any) {
      if (e instanceof Response || (e && typeof e === "object" && "headers" in e && "status" in e)) throw e;
      console.error("[_app beforeLoad] session check failed", e);
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Force users without a home tenant to the tenant-picker.
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (profile === null) return; // not yet loaded
    const onboardingPath = "/onboarding/tenant";
    if (!profile.tenant_id && location.pathname !== onboardingPath) {
      navigate({ to: onboardingPath });
    }
  }, [user, profile, loading, location.pathname, navigate]);

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
