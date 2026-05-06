import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Sparkles, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ambassador")({
  component: AmbassadorPage,
});

function AmbassadorPage() {
  const { user, profile } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [university, setUniversity] = useState("");
  const [social, setSocial] = useState("");
  const [motivation, setMotivation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("ambassador_applications").select("*").eq("user_id", user.id).maybeSingle();
      setApp(data);
      setUniversity(profile?.university ?? "");
      setLoading(false);
    })();
  }, [user, profile]);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("ambassador_applications")
      .insert({ user_id: user.id, university, social_handles: social || null, motivation })
      .select()
      .maybeSingle();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setApp(data);
    toast.success("Application submitted!");
  };

  const copyLink = () => {
    if (!app) return;
    const link = `${window.location.origin}/signup?ref=${app.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 text-white mb-2">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">Campus Ambassador Program</h1>
        <p className="mt-1 text-muted-foreground">Earn a monthly stipend by recruiting fellow students to UiPair.</p>
      </div>

      {app ? (
        <>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Your referral link</p>
                <p className="mt-1 font-mono text-sm break-all">{`${window.location.origin}/signup?ref=${app.referral_code}`}</p>
              </div>
              <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-4 w-4 mr-1" />Copy</Button>
            </div>
            <Badge variant={app.status === "approved" ? "default" : "outline"} className="mt-3">
              Status: {app.status}
            </Badge>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <DashCard icon={Users} label="Referrals this month" value={app.referrals_count} />
            <DashCard icon={DollarSign} label="Earnings" value={`$${(app.earnings_cents / 100).toFixed(2)}`} />
            <DashCard icon={Sparkles} label="Payout status" value="Pending" />
          </div>
        </>
      ) : (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Apply to become an ambassador</h2>
          <div><Label>University</Label><Input value={university} onChange={(e) => setUniversity(e.target.value)} /></div>
          <div><Label>Social handles (optional)</Label><Input value={social} onChange={(e) => setSocial(e.target.value)} placeholder="@yourhandle on IG, TikTok, X" /></div>
          <div><Label>Why do you want to be an ambassador?</Label><Textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={4} /></div>
          <Button onClick={submit} disabled={submitting || !university.trim() || !motivation.trim()}>
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        </Card>
      )}
    </div>
  );
}

function DashCard({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card className="p-4">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
