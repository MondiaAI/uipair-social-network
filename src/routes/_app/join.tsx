import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/_app/join")({
  validateSearch: searchSchema,
  component: JoinByInvitePage,
});

type Status = "idle" | "joining" | "success" | "error";

function JoinByInvitePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { token: prefilled } = useSearch({ from: "/_app/join" });
  const [input, setInput] = useState(prefilled ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [circleName, setCircleName] = useState<string | null>(null);

  const extractToken = (raw: string) => {
    const trimmed = raw.trim();
    const match = trimmed.match(/\/(?:invite|join)\/?\??(?:token=)?([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    const qMatch = trimmed.match(/[?&]token=([A-Za-z0-9_-]+)/);
    if (qMatch) return qMatch[1];
    return trimmed.replace(/^\/+|\/+$/g, "");
  };

  const join = async (raw: string) => {
    if (!user) return;
    const token = extractToken(raw);
    if (!token) { setError("Please paste an invite link or token."); setStatus("error"); return; }
    setStatus("joining");
    setError(null);
    setCircleName(null);

    // Preview circle name
    const { data: inv } = await supabase
      .from("circle_invites").select("circle_id").eq("token", token).maybeSingle();
    let targetCircleId: string | null = inv?.circle_id ?? null;
    if (targetCircleId) {
      const { data: c } = await supabase
        .from("circles").select("name").eq("id", targetCircleId).maybeSingle();
      setCircleName(c?.name ?? null);

      // Already a member?
      const { data: existing } = await supabase
        .from("circle_members").select("circle_id")
        .eq("circle_id", targetCircleId).eq("user_id", user.id).maybeSingle();
      if (existing) {
        setStatus("success");
        toast.info("You're already a member — taking you there.");
        navigate({ to: "/circles/$circleId", params: { circleId: targetCircleId } });
        return;
      }
    }

    const { data, error: rpcErr } = await supabase.rpc("redeem_circle_invite", { _token: token });
    if (rpcErr) {
      setError(rpcErr.message || "Could not redeem invite");
      setStatus("error");
      return;
    }
    const circleId = data as unknown as string;
    setStatus("success");
    toast.success("Joined circle!");
    navigate({ to: "/circles/$circleId", params: { circleId } });
  };

  // Auto-join when arriving with ?token=...
  useEffect(() => {
    if (prefilled && user) join(prefilled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilled, user?.id]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border bg-card p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
          <Users className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold mb-1">Join a circle</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Paste an invite link or token to join.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            placeholder="Invite link or token"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") join(input); }}
            disabled={status === "joining"}
          />
          <Button onClick={() => join(input)} disabled={!input.trim() || status === "joining"}>
            {status === "joining" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Join
          </Button>
        </div>

        {circleName && status !== "error" && (
          <p className="text-xs text-muted-foreground mb-3">
            Circle: <span className="font-medium text-foreground">{circleName}</span>
          </p>
        )}

        {status === "joining" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Joining…
          </div>
        )}
        {status === "success" && (
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3">
            <CheckCircle2 className="h-4 w-4" /> Joined! Redirecting…
          </div>
        )}
        {status === "error" && (
          <div className="space-y-3 text-left">
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/circles">Browse circles instead</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
