import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/peerly/AppShell";
import { useAuth } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Only redirect to /login once the AuthProvider has finished hydrating.
  // Using router-level beforeLoad with a fresh getSession() caused redirect
  // loops during token refresh, which made the app flash between /login and /feed.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loading, navigate]);

  // Force users without a home tenant to the tenant-picker, only after profile loads.
  useEffect(() => {
    if (loading || !user || !profile) return;
    const onboardingPath = "/onboarding/tenant";
    if (!profile.tenant_id && location.pathname !== onboardingPath) {
      navigate({ to: onboardingPath, replace: true });
    }
  }, [user, profile, loading, location.pathname, navigate]);

  if (loading || !user) {
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
