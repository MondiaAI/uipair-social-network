import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Sparkles, Users, DollarSign, Rocket, Briefcase, GraduationCap, ShoppingBag, FlaskConical, Megaphone, CheckCircle2, HelpCircle, Upload, IdCard, Camera, ImageIcon, Share2, Gift } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [fullPicFile, setFullPicFile] = useState<File | null>(null);
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

  const uploadDoc = async (file: File, kind: string): Promise<string | null> => {
    if (!user) return null;
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("ambassador-applications").upload(path, file, { upsert: true });
    if (error) { toast.error(`Upload failed: ${error.message}`); return null; }
    return path;
  };

  const submit = async () => {
    if (!user) return;
    if (!social.trim()) return toast.error("Social media handle is required");
    if (!studentIdFile) return toast.error("Student identity card is required");
    if (!passportFile) return toast.error("Passport photo is required");
    if (!fullPicFile) return toast.error("Full picture is required");
    setSubmitting(true);
    const [studentIdUrl, passportUrl, fullPicUrl] = await Promise.all([
      uploadDoc(studentIdFile, "student-id"),
      uploadDoc(passportFile, "passport"),
      uploadDoc(fullPicFile, "full-picture"),
    ]);
    if (!studentIdUrl || !passportUrl || !fullPicUrl) { setSubmitting(false); return; }
    const { data, error } = await supabase
      .from("ambassador_applications")
      .insert({
        user_id: user.id,
        university,
        social_handles: social,
        motivation,
        student_id_card_url: studentIdUrl,
        passport_photo_url: passportUrl,
        full_picture_url: fullPicUrl,
      })
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
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Apply to become an ambassador</h2>
            <p className="text-xs text-muted-foreground mt-1">Review the eligibility checklist below before submitting.</p>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">✅ Eligibility checklist</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "You are a currently enrolled university student (valid student ID required)",
                "You have an active UiPair account with a complete profile",
                "You have an active, real social media handle (IG, TikTok, X, LinkedIn, or WhatsApp community) — required",
                "You can provide a clear passport photo and a full-body picture for your ambassador profile",
                "You can commit to recruiting and supporting students for at least 3 months",
                "You can represent UiPair professionally on your campus",
              ].map((item) => (
                <li key={item} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{item}</span></li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border p-4 space-y-1">
            <p className="text-sm font-medium">📝 What you'll need to submit</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li><span className="text-foreground font-medium">University</span> — required</li>
              <li><span className="text-foreground font-medium">Social media handle</span> — required, must be active and verifiable</li>
              <li><span className="text-foreground font-medium">Motivation</span> — required, 2–4 sentences on why you want to represent UiPair and your reach on campus</li>
              <li><span className="text-foreground font-medium">Student identity card</span> — required, clear photo of your valid student ID</li>
              <li><span className="text-foreground font-medium">Passport photo</span> — required, clear headshot on a plain background</li>
              <li><span className="text-foreground font-medium">Full picture</span> — required, full-body photo of yourself</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">Accepted formats: JPG, PNG, HEIC. Max 10MB per file.</p>
          </div>

          <div className="space-y-3">
            <div><Label>University <span className="text-destructive">*</span></Label><Input value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g. University of Lagos" /></div>
            <div><Label>Social media handle <span className="text-destructive">*</span></Label><Input value={social} onChange={(e) => setSocial(e.target.value)} placeholder="@yourhandle on IG, TikTok, X, or LinkedIn" /></div>
            <div>
              <Label>Why do you want to be an ambassador? <span className="text-destructive">*</span></Label>
              <Textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={4} placeholder="Tell us about your campus reach, community involvement, and why you'd be a great UiPair ambassador." />
            </div>

            <FileUpload
              icon={IdCard}
              label="Student identity card"
              hint="Upload a clear photo of your valid student ID"
              file={studentIdFile}
              onChange={setStudentIdFile}
            />
            <FileUpload
              icon={Camera}
              label="Passport photo"
              hint="Clear headshot, plain background"
              file={passportFile}
              onChange={setPassportFile}
            />
            <FileUpload
              icon={ImageIcon}
              label="Full picture"
              hint="Full-body photo of yourself"
              file={fullPicFile}
              onChange={setFullPicFile}
            />
          </div>

          <Button onClick={submit} disabled={submitting || !university.trim() || !motivation.trim() || !social.trim() || !studentIdFile || !passportFile || !fullPicFile}>
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Frequently asked questions</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="eligibility">
            <AccordionTrigger className="text-sm text-left">Who is eligible to become a Campus Ambassador?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Any currently enrolled university student with an active UiPair account, a complete profile, and a real presence on campus or social media. We accept undergrads, postgrads, and PhD students from any country, any field of study, and any year of study.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="review">
            <AccordionTrigger className="text-sm text-left">How long does the application review take?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Our team reviews every application within <span className="font-medium text-foreground">48 hours</span>. You'll see your status update on this page (Pending → Approved or Declined). Approved ambassadors get an email with their referral link, badge, and starter kit.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="referrals">
            <AccordionTrigger className="text-sm text-left">How does referral tracking work?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Once approved, you receive a unique referral link (e.g. <span className="font-mono text-xs">uipair.com/signup?ref=YOUR-CODE</span>). When a student signs up using your link, the referral is permanently attributed to you. You can see all your referrals and their status (Signed up → Paid) live in your Ambassador dashboard on this page.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="earnings">
            <AccordionTrigger className="text-sm text-left">When and how do I get paid?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              You earn <span className="font-medium text-foreground">$1 for every paid signup</span> through your link. Earnings accumulate in your UiPair wallet in real time and are paid out <span className="font-medium text-foreground">monthly</span> once your balance reaches the <span className="font-medium text-foreground">$20 minimum payout</span>. Payouts are processed via mobile money, bank transfer, or PayPal depending on your country.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="unlimited">
            <AccordionTrigger className="text-sm text-left">How do I unlock unlimited free UiPair access?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Recruit <span className="font-medium text-foreground">50 active paid signups per week</span> and your account auto-upgrades to full Pro access — every premium feature, unlimited Lab projects, 5GB storage, and the verified Pro badge. As long as you maintain that target, your unlimited access stays free.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="duration">
            <AccordionTrigger className="text-sm text-left">How long does the ambassadorship last?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Ambassadorships run in 6-month cycles and are renewable based on your activity. At the end of each cycle, you receive your verified digital certificate to share on your CV and LinkedIn.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="rejected">
            <AccordionTrigger className="text-sm text-left">What happens if my application is declined?</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              You can re-apply after 30 days. The most common reasons for rejection are an incomplete UiPair profile or a motivation statement that lacks detail about your campus reach. Strengthen those areas and try again.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
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

function FileUpload({ icon: Icon, label, hint, file, onChange }: { icon: any; label: string; hint: string; file: File | null; onChange: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    onChange(f);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{label} <span className="text-destructive">*</span></Label>
      <label className="flex items-center gap-3 rounded-md border border-dashed p-3 cursor-pointer hover:bg-muted/40 transition">
        {preview ? (
          <img src={preview} alt={label} className="h-14 w-14 rounded object-cover" />
        ) : (
          <div className="h-14 w-14 rounded bg-muted flex items-center justify-center"><Upload className="h-5 w-5 text-muted-foreground" /></div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file ? file.name : "Tap to upload"}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={handle} />
      </label>
    </div>
  );
}
