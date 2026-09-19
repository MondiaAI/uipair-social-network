import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SplitAuthLayout } from "@/components/peerly/SplitAuthLayout";
import { PasswordInput } from "@/components/peerly/PasswordInput";
import { Loader2 } from "lucide-react";


export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const navigatedRef = useRef(false);

  // Wait for Supabase auth hydration to finish before redirecting,
  // so we never flash a sign-out state on /login.
  useEffect(() => {
    if (authLoading) return;
    if (user && !navigatedRef.current) {
      navigatedRef.current = true;
      navigate({ to: "/feed", replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setLoading(true);
    let error;
    try {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } catch {
      submittingRef.current = false;
      setLoading(false);
      toast.error("Network error — check your connection and try again.");
      return;
    }
    if (error) {
      submittingRef.current = false;
      setLoading(false);
      toast.error(error.message);
      return;
    }
    // Keep loading=true; the useEffect on `user` will navigate once the
    // AuthProvider picks up the hydrated session, preventing a flash.
  };

  return (
    <SplitAuthLayout>
      <div className="space-y-6">
        <div className="text-center lg:text-left">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to connect with students worldwide.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <form onSubmit={handleEmailLogin} className="space-y-3" autoComplete="on">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={loading || authLoading} aria-busy={loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="hover:underline">Terms</Link>
          {" "}and{" "}
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </SplitAuthLayout>
  );
}
