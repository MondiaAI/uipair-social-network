import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Briefcase, Building2, Calendar, MapPin, Globe, DollarSign,
  Clock, Sparkles, Bookmark, BookmarkCheck, Send, ExternalLink, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProUpgradeModal } from "@/components/peerly/ProUpgradeModal";

export const Route = createFileRoute("/_app/jobs/$jobId")({
  component: JobDetailsPage,
  head: () => ({ meta: [{ title: "Job · UiPair" }] }),
});

type Posting = {
  id: string;
  poster_id: string;
  title: string;
  company: string;
  description: string;
  job_type: string;
  category: "internship" | "employment";
  location: string | null;
  is_remote: boolean;
  is_paid: boolean;
  compensation: string | null;
  requirements: string | null;
  benefits: string | null;
  company_logo_url: string | null;
  company_website: string | null;
  company_size: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  duration_months: number | null;
  stipend_amount: number | null;
  apply_url: string | null;
  apply_email: string | null;
  deadline: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
};

function JobDetailsPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isPremium = !!profile?.is_pro;

  const [job, setJob] = useState<Posting | null>(null);
  const [poster, setPoster] = useState<{ full_name: string | null; avatar_url: string | null; university: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<{ id: string; status: string } | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("job_postings").select("*").eq("id", jobId).maybeSingle();
      if (cancelled) return;
      setJob((data as Posting | null) ?? null);
      if (data) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name,avatar_url,university")
          .eq("id", (data as Posting).poster_id)
          .maybeSingle();
        if (!cancelled) setPoster(p as any);
      }
      if (profile?.id) {
        const { data: existing } = await supabase
          .from("job_applications")
          .select("id,status")
          .eq("job_id", jobId)
          .eq("user_id", profile.id)
          .maybeSingle();
        if (!cancelled) setApp(existing as any);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [jobId, profile?.id]);

  const saveJob = async () => {
    if (!profile) return;
    if (!isPremium) return setShowUpgrade(true);
    if (app) {
      const { error } = await supabase.from("job_applications").delete().eq("id", app.id);
      if (error) return toast.error(error.message);
      setApp(null);
      toast.success("Removed from your tracker");
      return;
    }
    const { data, error } = await supabase
      .from("job_applications")
      .insert({ job_id: jobId, user_id: profile.id, status: "saved" })
      .select("id,status")
      .single();
    if (error) return toast.error(error.message);
    setApp(data as any);
    toast.success("Saved");
  };

  if (loading) {
    return <div className="mx-auto max-w-4xl p-8 text-center text-muted-foreground">Loading…</div>;
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center space-y-3">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/gigs" })}>Back to Jobs</Button>
      </div>
    );
  }

  const isSaved = app?.status === "saved";
  const isApplied = !!app && app.status !== "saved";

  const salary = (() => {
    if (job.salary_min || job.salary_max) {
      const cur = job.salary_currency ?? "USD";
      const per = job.salary_period ? `/${job.salary_period}` : "";
      if (job.salary_min && job.salary_max)
        return `${cur} ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}${per}`;
      return `${cur} ${(job.salary_min ?? job.salary_max)!.toLocaleString()}${per}`;
    }
    return null;
  })();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link to="/gigs"><ArrowLeft className="h-4 w-4" /> Back to Jobs</Link>
      </Button>

      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          {job.company_logo_url ? (
            <img src={job.company_logo_url} alt={job.company} className="h-14 w-14 rounded-lg border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn(
                "text-[10px] uppercase tracking-wide",
                job.category === "internship"
                  ? "bg-blue-100 text-blue-700 border-blue-200"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200",
              )}>
                {job.category === "internship" ? "Internship" : "Employment"}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">{job.job_type.replace("_", " ")}</Badge>
              {job.experience_level && (
                <Badge variant="secondary" className="text-[10px] capitalize">{job.experience_level}</Badge>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{job.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{job.company}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground border-y py-3">
          {(job.location || job.is_remote) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {job.is_remote ? (job.location ? `${job.location} · Remote` : "Remote") : job.location}
            </span>
          )}
          {salary && (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <DollarSign className="h-4 w-4" /> {salary}
            </span>
          )}
          {job.compensation && !salary && (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <DollarSign className="h-4 w-4" /> {job.compensation}
            </span>
          )}
          {job.category === "internship" && job.duration_months && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" /> {job.duration_months} months
            </span>
          )}
          {job.deadline && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Apply by {new Date(job.deadline).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!isPremium ? (
            <Button onClick={() => setShowUpgrade(true)} className="gap-2">
              <Lock className="h-4 w-4" /> Premium — Unlock Apply
            </Button>
          ) : (
            <>
              <Button onClick={() => setShowApply(true)} disabled={isApplied} className="gap-2">
                {isApplied ? <><BookmarkCheck className="h-4 w-4" /> Applied</> : <><Send className="h-4 w-4" /> Apply</>}
              </Button>
              <Button variant="outline" onClick={saveJob} className="gap-2">
                {isSaved ? <><BookmarkCheck className="h-4 w-4" /> Saved</> : <><Bookmark className="h-4 w-4" /> Save</>}
              </Button>
              {job.apply_url && (
                <Button asChild variant="ghost" className="gap-2">
                  <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
                    External link <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <section>
          <h2 className="mb-2 text-lg font-semibold">About the role</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{job.description}</p>
        </section>

        {job.requirements && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Requirements</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{job.requirements}</p>
          </section>
        )}

        {job.benefits && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Benefits</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{job.benefits}</p>
          </section>
        )}

        {job.tags.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Skills</h2>
            <div className="flex flex-wrap gap-1.5">
              {job.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          </section>
        )}
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold inline-flex items-center gap-2">
          <Building2 className="h-5 w-5" /> About {job.company}
        </h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {job.company_size && (
            <div><span className="text-muted-foreground">Company size: </span><span className="font-medium">{job.company_size}</span></div>
          )}
          {job.company_website && (
            <div className="inline-flex items-center gap-1">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a href={job.company_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                {job.company_website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>
        {poster && (
          <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Posted by <span className="font-medium text-foreground">{poster.full_name}</span>
            {poster.university && <>· {poster.university} alumni</>}
          </div>
        )}
      </Card>

      <ApplyDialog
        open={showApply}
        onOpenChange={setShowApply}
        jobId={job.id}
        onApplied={(a) => { setApp(a); setShowApply(false); }}
      />
      <ProUpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </div>
  );
}

function ApplyDialog({
  open, onOpenChange, jobId, onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  onApplied: (app: { id: string; status: string }) => void;
}) {
  const { profile } = useAuth();
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!profile) return;
    if (coverLetter.trim().length < 30) return toast.error("Cover letter should be at least 30 characters.");
    if (resumeUrl && !/^https?:\/\//i.test(resumeUrl)) return toast.error("Resume URL must start with http(s)://");
    setSaving(true);
    const { data, error } = await supabase
      .from("job_applications")
      .upsert(
        { job_id: jobId, user_id: profile.id, status: "applied", cover_letter: coverLetter.trim(), resume_url: resumeUrl.trim() || null },
        { onConflict: "job_id,user_id" },
      )
      .select("id,status")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted");
    onApplied(data as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Apply</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cover">Cover letter</Label>
            <Textarea id="cover" rows={7} maxLength={4000} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Why you're a great fit (min 30 chars)…" />
            <p className="mt-1 text-xs text-muted-foreground">{coverLetter.length}/4000</p>
          </div>
          <div>
            <Label htmlFor="resume">Resume / portfolio URL (optional)</Label>
            <Input id="resume" type="url" value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-2">
            <Send className="h-4 w-4" /> {saving ? "Submitting…" : "Submit application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
