import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { Loader2, AlertCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/invite/$token")({
  component: InviteRedeemPage,
});

function InviteRedeemPage() {
  const { token } = useParams({ from: "/_app/invite/$token" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [circleName, setCircleName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Preview the invite to show the circle name (best-effort)
      const { data: inv } = await supabase
        .from("circle_invites")
        .select("circle_id")
        .eq("token", token)
        .maybeSingle();
      if (inv) {
        const { data: c } = await supabase
          .from("circles").select("name").eq("id", inv.circle_id).maybeSingle();
        setCircleName(c?.name ?? null);

        // If already a member, skip redemption and go straight to the circle.
        const { data: existing } = await supabase
          .from("circle_members")
          .select("circle_id")
          .eq("circle_id", inv.circle_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) {
          setStatus("ok");
          toast.info("You're already a member of this circle");
          navigate({ to: "/circles/$circleId", params: { circleId: inv.circle_id } });
          return;
        }
      }

      const { data, error } = await supabase.rpc("redeem_circle_invite", { _token: token });
      if (error) {
        setErrorMsg(error.message || "Could not redeem invite");
        setStatus("error");
        return;
      }
      const circleId = data as unknown as string;
      setStatus("ok");
      toast.success("Joined circle!");
      navigate({ to: "/circles/$circleId", params: { circleId } });
    })();
    // eslint-disable-next-line
  }, [token, user?.id]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-xl border bg-card p-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Users className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold mb-1">Circle invite</h1>
        {circleName && <p className="text-sm text-muted-foreground mb-4">You're joining <span className="font-medium text-foreground">{circleName}</span></p>}

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Redeeming invite…
          </div>
        )}
        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3 text-left">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/circles">Back to circles</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
