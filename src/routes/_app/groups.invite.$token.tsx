import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/groups/invite/$token")({
  component: RedeemInvitePage,
});

function RedeemInvitePage() {
  const { token } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Joining group…");

  useEffect(() => {
    if (!user) {
      // stash and redirect to login
      sessionStorage.setItem("post_login_redirect", `/groups/invite/${token}`);
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("redeem_group_invite", { _token: token });
      if (error) {
        setMsg(error.message);
        toast.error(error.message);
        return;
      }
      toast.success("You joined the group!");
      navigate({ to: "/groups/$groupId", params: { groupId: data as string }, replace: true });
    })();
  }, [token, user, navigate]);

  return (
    <div className="p-10 text-center">
      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}
