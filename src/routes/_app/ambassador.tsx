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
import { Copy, Sparkles, Users, DollarSign, Rocket, Briefcase, GraduationCap, ShoppingBag, FlaskConical, Megaphone } from "lucide-react";
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
        <h1 className="text-2xl font-bold">Become a UiPair Campus Ambassador</h1>
        <p className="mt-1 text-muted-foreground">
          The UiPair Campus Ambassador Program is one of the most rewarding opportunities on the platform.
          As an Ambassador, you become the official face of UiPair at your university — and you get paid and
          rewarded for it in ways that go far beyond just money.
        </p>
      </div>

      <Card className="p-5 space-y-2">
        <h2 className="font-semibold">What is a Campus Ambassador?</h2>
        <p className="text-sm text-muted-foreground">
          A Campus Ambassador is a student leader appointed by UiPair to represent the platform at their
          university. You recruit fellow students, run campus events, spread the word, and build the UiPair
          community at your institution. In return, UiPair takes care of you with real, tangible benefits
          that grow as you grow.
        </p>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">💎 Ambassador Benefits</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <BenefitCard
            icon={DollarSign}
            title="Earn $1 for every paid signup"
            body="Every time a student signs up through your personal referral link and becomes a paid UiPair user, you earn $1 — directly into your UiPair wallet. No cap on earnings. Your hustle sets the limit."
          />
          <BenefitCard
            icon={Rocket}
            title="Unlimited UiPair access — free"
            body="Recruit 50 active students per week and your account auto-upgrades to full unlimited access. Every Pro feature, Premium Circle, unlimited Lab projects, 5GB storage, advanced gig tools, and verified Pro badge — all free as long as you maintain that target."
          />
          <BenefitCard
            icon={Briefcase}
            title="Priority access to jobs & internships"
            body="Get first access to all job and internship postings on UiPair before they go public. Recruiters know Ambassadors are high-initiative — your status alone makes your profile stand out."
          />
          <BenefitCard
            icon={GraduationCap}
            title="Official Ambassador certificate"
            body="At the end of your ambassadorship, UiPair issues a verified digital certificate — a real, shareable credential for your CV, LinkedIn, and job applications."
          />
          <BenefitCard
            icon={ShoppingBag}
            title="Full access to Gigs & StudyGigs"
            body="Post unlimited gigs, claim bounties, sell resources, and lead Premium Circles. Your profile gets a special Ambassador badge that boosts buyer trust and your earning potential."
          />
          <BenefitCard
            icon={FlaskConical}
            title="Full access to The Lab"
            body="Unlimited project slots — build as many research projects, startups, or hackathon teams as you want. Plus early access to sponsored hackathons before they open to the public."
          />
          <BenefitCard
            icon={Megaphone}
            title="Official UiPair campus branding"
            body="Receive official branded materials, social media templates, and promotional content for your campus. Your name and university get featured on the UiPair Ambassador page worldwide."
          />
        </div>
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">How to become a Campus Ambassador</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Tap <span className="font-medium text-foreground">"Apply"</span> below to start your application.</li>
          <li>Fill in a short form — your university, your social reach, and why you want to represent UiPair.</li>
          <li>Our team reviews your application within 48 hours.</li>
          <li>Once approved, you receive your personal referral link, your Ambassador badge, and your branded starter kit.</li>
          <li>Start recruiting, start earning, and start building your legacy on campus.</li>
        </ol>
      </Card>

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

function BenefitCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <Card className="p-4">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="font-semibold text-sm">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{body}</p>
    </Card>
  );
}
