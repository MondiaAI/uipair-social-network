import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Briefcase, Lock, MapPin, Plus, Search, Calendar, Building2, Sparkles, GraduationCap, Megaphone, Clock, ChevronRight, ShieldCheck } from "lucide-react";
import { ProUpgradeModal } from "@/components/peerly/ProUpgradeModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type JobType = "internship" | "full_time" | "part_time" | "contract" | "volunteer";
type Category = "internship" | "employment";
type ExperienceLevel = "entry" | "mid" | "senior" | "lead";
type SalaryPeriod = "hour" | "month" | "year";
type SubmissionKind = "job" | "internship" | "employment" | "paid_ad";

type JobPosting = {
  id: string;
  poster_id: string;
  title: string;
  company: string;
  description: string;
  job_type: JobType;
  category: Category;
  location: string | null;
  is_remote: boolean;
  is_paid: boolean;
  compensation: string | null;
  apply_url: string | null;
  apply_email: string | null;
  deadline: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  requirements: string | null;
  benefits: string | null;
  company_logo_url: string | null;
  company_website: string | null;
  experience_level: ExperienceLevel | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: SalaryPeriod | null;
  duration_months: number | null;
  stipend_amount: number | null;
};

type Application = {
  id: string;
  job_id: string;
  status: "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
};

const STATUS_LABEL: Record<Application["status"], string> = {
  saved: "Saved", applied: "Applied", interviewing: "Interviewing",
  offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};

const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  entry: "Entry-level", mid: "Mid-level", senior: "Senior", lead: "Lead",
};

const formatSalary = (j: JobPosting) => {
  if (j.salary_min == null && j.salary_max == null) return null;
  const cur = j.salary_currency ?? "USD";
  const period = j.salary_period ? `/${j.salary_period}` : "";
  if (j.salary_min && j.salary_max) return `${cur} ${j.salary_min.toLocaleString()}–${j.salary_max.toLocaleString()}${period}`;
  return `${cur} ${(j.salary_min ?? j.salary_max)!.toLocaleString()}${period}`;
};

export function JobsDashboard() {
  const { profile } = useAuth();
  const isPremium = !!profile?.is_pro;

  const [isAdmin, setIsAdmin] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"internships" | "employment" | "tracker">("internships");

  useEffect(() => {
    if (!profile?.id) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", profile.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [profile?.id]);

  const loadData = async () => {
    if (!isPremium) return;
    setLoading(true);
    const [{ data: jobsData }, { data: appsData }] = await Promise.all([
      supabase.from("job_postings").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(100),
      profile ? supabase.from("job_applications").select("id,job_id,status").order("updated_at", { ascending: false }) : Promise.resolve({ data: [] as Application[] }),
    ]);
    setJobs((jobsData ?? []) as JobPosting[]);
    setApps((appsData ?? []) as Application[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [isPremium, profile?.id]);

  // ─── Paywall ───
  if (!isPremium) {
    return (
      <>
        <Card className="relative overflow-hidden p-8 text-center">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-50 via-background to-emerald-50 opacity-70" />
          <div className="relative space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold inline-flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" /> Internships & Employment
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Curated internships and jobs vetted and published by the UiPair team — available to Premium members only.
              </p>
            </div>
            <Button onClick={() => setShowUpgrade(true)} className="gap-2">
              <Sparkles className="h-4 w-4" /> Upgrade to Premium
            </Button>
          </div>
        </Card>
        <ProUpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold inline-flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Internships & Employment
          </h2>
          <p className="text-sm text-muted-foreground">
            Curated opportunities published by UiPair — exclusively for Premium members.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowSubmit(true)} variant="outline" className="gap-2">
            <Megaphone className="h-4 w-4" /> Submit a posting
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowPost(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Post (admin)
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground inline-flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          Only the UiPair team publishes jobs, internships and paid ads. Have an opportunity to share?
          <button className="ml-1 underline" onClick={() => setShowSubmit(true)}>Submit it</button> and our team will review it.
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="internships" className="gap-1.5">
            <GraduationCap className="h-4 w-4" /> Internships
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-1.5">
            <Briefcase className="h-4 w-4" /> Employment
          </TabsTrigger>
          <TabsTrigger value="tracker">My Tracker ({apps.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="internships" className="pt-3">
          <CategoryBrowser
            category="internship"
            jobs={jobs.filter((j) => j.category === "internship")}
            loading={loading}
            apps={apps}
          />
        </TabsContent>

        <TabsContent value="employment" className="pt-3">
          <CategoryBrowser
            category="employment"
            jobs={jobs.filter((j) => j.category === "employment")}
            loading={loading}
            apps={apps}
          />
        </TabsContent>

        <TabsContent value="tracker" className="space-y-3 pt-3">
          {apps.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              Save or apply to jobs from the details page to build your tracker.
            </Card>
          ) : (
            <div className="space-y-2">
              {jobs.filter((j) => apps.some((a) => a.job_id === j.id)).map((j) => {
                const a = apps.find((x) => x.job_id === j.id)!;
                return (
                  <Link
                    key={j.id}
                    to="/jobs/$jobId"
                    params={{ jobId: j.id }}
                    className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{j.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{j.company}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[a.status]}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PostJobDialog
        open={showPost}
        onOpenChange={setShowPost}
        isAdmin={isAdmin}
        onCreated={() => { setShowPost(false); loadData(); }}
      />
      <SubmitPostingDialog
        open={showSubmit}
        onOpenChange={setShowSubmit}
        onSubmitted={() => setShowSubmit(false)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Category browser — internship or employment, with dedicated filters
// ═══════════════════════════════════════════════════════════════════
function CategoryBrowser({
  category, jobs, loading, apps,
}: { category: Category; jobs: JobPosting[]; loading: boolean; apps: Application[]; }) {
  const [search, setSearch] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [paidOnly, setPaidOnly] = useState(false);
  // employment-only
  const [experience, setExperience] = useState<ExperienceLevel | "all">("all");
  const [employType, setEmployType] = useState<JobType | "all">("all");
  // internship-only
  const [maxDuration, setMaxDuration] = useState<string>("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (remoteOnly && !j.is_remote) return false;
      if (paidOnly && !j.is_paid) return false;
      if (category === "employment") {
        if (experience !== "all" && j.experience_level !== experience) return false;
        if (employType !== "all" && j.job_type !== employType) return false;
      }
      if (category === "internship" && maxDuration !== "all") {
        const max = parseInt(maxDuration, 10);
        if (!j.duration_months || j.duration_months > max) return false;
      }
      if (!term) return true;
      return (
        j.title.toLowerCase().includes(term) ||
        j.company.toLowerCase().includes(term) ||
        (j.location ?? "").toLowerCase().includes(term) ||
        j.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [jobs, search, remoteOnly, paidOnly, category, experience, employType, maxDuration]);

  const appIds = new Set(apps.map((a) => a.job_id));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, company, tag…" className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {category === "employment" && (
            <>
              <Select value={employType} onValueChange={(v) => setEmployType(v as JobType | "all")}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceLevel | "all")}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Seniority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any seniority</SelectItem>
                  {(Object.keys(EXPERIENCE_LABEL) as ExperienceLevel[]).map((l) => (
                    <SelectItem key={l} value={l}>{EXPERIENCE_LABEL[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {category === "internship" && (
            <Select value={maxDuration} onValueChange={setMaxDuration}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Duration" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any duration</SelectItem>
                <SelectItem value="3">≤ 3 months</SelectItem>
                <SelectItem value="6">≤ 6 months</SelectItem>
                <SelectItem value="12">≤ 12 months</SelectItem>
              </SelectContent>
            </Select>
          )}
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={remoteOnly} onCheckedChange={setRemoteOnly} /> Remote
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={paidOnly} onCheckedChange={setPaidOnly} /> Paid
          </label>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading opportunities…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          <Briefcase className="mx-auto mb-2 h-8 w-8" />
          No {category === "internship" ? "internships" : "jobs"} match your filters yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((j) => (
            <JobCard key={j.id} job={j} tracked={appIds.has(j.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Job card → links to /jobs/$jobId
// ═══════════════════════════════════════════════════════════════════
function JobCard({ job, tracked }: { job: JobPosting; tracked: boolean }) {
  const salary = formatSalary(job);
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="group block"
    >
      <Card className="flex h-full flex-col gap-2 p-4 transition hover:border-primary hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {job.company_logo_url ? (
              <img src={job.company_logo_url} alt="" className="h-9 w-9 rounded border object-cover" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded border bg-muted text-xs font-semibold text-muted-foreground">
                {job.company.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-snug group-hover:text-primary">{job.title}</h3>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> {job.company}
              </p>
            </div>
          </div>
          {tracked && <Badge variant="secondary" className="shrink-0 text-[10px]">Tracking</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {(job.location || job.is_remote) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.is_remote ? (job.location ? `${job.location} · Remote` : "Remote") : job.location}
            </span>
          )}
          {job.category === "internship" && job.duration_months && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {job.duration_months} mo</span>
          )}
          {job.category === "internship" && job.stipend_amount != null && (
            <span className="font-medium text-emerald-600">
              {(job.salary_currency ?? "USD")} {job.stipend_amount.toLocaleString()}/mo
            </span>
          )}
          {job.category === "employment" && salary && (
            <span className="font-medium text-emerald-600">{salary}</span>
          )}
          {job.category === "employment" && job.experience_level && (
            <Badge variant="outline" className="text-[10px]">{EXPERIENCE_LABEL[job.experience_level]}</Badge>
          )}
          {job.deadline && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {new Date(job.deadline).toLocaleDateString()}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">{job.description}</p>

        {job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {job.tags.slice(0, 5).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-end pt-2 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
          View details <ChevronRight className="h-3 w-3" />
        </div>
      </Card>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Admin-only: post directly to job_postings (full type-specific fields)
// ═══════════════════════════════════════════════════════════════════
function PostJobDialog({
  open, onOpenChange, isAdmin, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; isAdmin: boolean; onCreated: () => void; }) {
  const { profile } = useAuth();
  const [category, setCategory] = useState<Category>("internship");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");
  const [jobType, setJobType] = useState<JobType>("internship");
  const [location, setLocation] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [applyUrl, setApplyUrl] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  // employment
  const [experience, setExperience] = useState<ExperienceLevel | "">("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>("year");
  // internship
  const [durationMonths, setDurationMonths] = useState("");
  const [stipend, setStipend] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setJobType(category === "internship" ? "internship" : "full_time");
  }, [category]);

  const submit = async () => {
    if (!profile) return;
    if (title.trim().length < 3) return toast.error("Title must be at least 3 characters");
    if (!company.trim()) return toast.error("Company is required");
    if (description.trim().length < 10) return toast.error("Description must be at least 10 characters");
    if (!applyUrl.trim() && !applyEmail.trim()) return toast.error("Provide an apply link or apply email");
    if (applyUrl.trim() && !/^https?:\/\//i.test(applyUrl.trim())) return toast.error("Apply link must start with http(s)://");
    if (applyEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyEmail.trim())) return toast.error("Apply email is invalid");
    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) return toast.error("Salary min cannot exceed max");

    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    setSaving(true);
    const { error } = await supabase.from("job_postings").insert({
      poster_id: profile.id,
      title: title.trim(),
      company: company.trim(),
      company_website: companyWebsite.trim() || null,
      company_logo_url: companyLogo.trim() || null,
      description: description.trim(),
      requirements: requirements.trim() || null,
      benefits: benefits.trim() || null,
      job_type: jobType,
      category,
      location: location.trim() || null,
      is_remote: isRemote,
      is_paid: isPaid,
      compensation: null,
      apply_url: applyUrl.trim() || null,
      apply_email: applyEmail.trim() || null,
      deadline: deadline || null,
      tags,
      experience_level: category === "employment" && experience ? experience : null,
      salary_min: category === "employment" && salaryMin ? Number(salaryMin) : null,
      salary_max: category === "employment" && salaryMax ? Number(salaryMax) : null,
      salary_currency: category === "employment" ? salaryCurrency : (stipend ? salaryCurrency : null),
      salary_period: category === "employment" && (salaryMin || salaryMax) ? salaryPeriod : null,
      duration_months: category === "internship" && durationMonths ? Number(durationMonths) : null,
      stipend_amount: category === "internship" && stipend ? Number(stipend) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Posting published");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish a posting (UiPair admin)</DialogTitle>
          <DialogDescription>
            Only the UiPair team can publish here. Fill in the type-specific fields below.
          </DialogDescription>
        </DialogHeader>

        {!isAdmin ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            You are not a UiPair admin. Use “Submit a posting” instead — our team will review and publish it for you.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory("internship")}
                className={cn("rounded-md border p-3 text-left transition", category === "internship" ? "border-primary bg-primary/5" : "hover:bg-accent")}
              >
                <p className="text-sm font-semibold inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> Internship</p>
                <p className="text-xs text-muted-foreground mt-0.5">Duration · stipend · learning outcomes</p>
              </button>
              <button
                type="button"
                onClick={() => setCategory("employment")}
                className={cn("rounded-md border p-3 text-left transition", category === "employment" ? "border-primary bg-primary/5" : "hover:bg-accent")}
              >
                <p className="text-sm font-semibold inline-flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> Employment</p>
                <p className="text-xs text-muted-foreground mt-0.5">Seniority · salary range · employment type</p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={category === "internship" ? "Data Science Intern" : "Senior Backend Engineer"} />
              </div>
              <div>
                <Label>Company *</Label>
                <Input maxLength={150} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc" />
              </div>
              <div>
                <Label>Company website</Label>
                <Input type="url" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://acme.com" />
              </div>
              <div className="col-span-2">
                <Label>Company logo URL</Label>
                <Input type="url" value={companyLogo} onChange={(e) => setCompanyLogo(e.target.value)} placeholder="https://…/logo.png" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairobi, Kenya" />
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="inline-flex items-center gap-2 text-sm"><Switch checked={isRemote} onCheckedChange={setIsRemote} /> Remote</label>
                <label className="inline-flex items-center gap-2 text-sm"><Switch checked={isPaid} onCheckedChange={setIsPaid} /> Paid</label>
              </div>

              {category === "employment" && (
                <>
                  <div>
                    <Label>Employment type</Label>
                    <Select value={jobType} onValueChange={(v) => setJobType(v as JobType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full-time</SelectItem>
                        <SelectItem value="part_time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="volunteer">Volunteer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Seniority</Label>
                    <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceLevel)}>
                      <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(EXPERIENCE_LABEL) as ExperienceLevel[]).map((l) => (
                          <SelectItem key={l} value={l}>{EXPERIENCE_LABEL[l]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase().slice(0, 3))} placeholder="USD" />
                  </div>
                  <div>
                    <Label>Per</Label>
                    <Select value={salaryPeriod} onValueChange={(v) => setSalaryPeriod(v as SalaryPeriod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hour">Hour</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="year">Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Salary min</Label>
                    <Input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="50000" />
                  </div>
                  <div>
                    <Label>Salary max</Label>
                    <Input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="80000" />
                  </div>
                </>
              )}

              {category === "internship" && (
                <>
                  <div>
                    <Label>Duration (months)</Label>
                    <Input type="number" min={1} max={36} value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} placeholder="3" />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase().slice(0, 3))} placeholder="USD" />
                  </div>
                  <div className="col-span-2">
                    <Label>Stipend / month</Label>
                    <Input type="number" min={0} value={stipend} onChange={(e) => setStipend(e.target.value)} placeholder="800" />
                  </div>
                </>
              )}

              <div className="col-span-2">
                <Label>Description *</Label>
                <Textarea rows={4} maxLength={8000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is the role about?" />
              </div>
              <div className="col-span-2">
                <Label>Requirements</Label>
                <Textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="• Strong Python skills&#10;• Currently enrolled in a CS program" />
              </div>
              <div className="col-span-2">
                <Label>Benefits / perks</Label>
                <Textarea rows={3} value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="• Remote-friendly&#10;• Health insurance" />
              </div>

              <div>
                <Label>Apply URL</Label>
                <Input type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <Label>…or Email</Label>
                <Input type="email" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)} placeholder="careers@acme.com" />
              </div>
              <div>
                <Label>Deadline</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="React, Python, Marketing" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!isAdmin || saving}>{saving ? "Publishing…" : "Publish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Anyone signed in: submit a posting request to UiPair admins
// ═══════════════════════════════════════════════════════════════════
function SubmitPostingDialog({
  open, onOpenChange, onSubmitted,
}: { open: boolean; onOpenChange: (o: boolean) => void; onSubmitted: () => void; }) {
  const { profile, user } = useAuth();
  const [kind, setKind] = useState<SubmissionKind>("internship");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");
  const [location, setLocation] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [compensation, setCompensation] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [experience, setExperience] = useState<ExperienceLevel | "">("");
  const [duration, setDuration] = useState("");
  const [stipend, setStipend] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [adBudget, setAdBudget] = useState("");
  const [adDays, setAdDays] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setContactEmail(user?.email ?? ""); }, [user?.email]);

  const submit = async () => {
    if (!profile) return toast.error("Sign in to submit");
    if (title.trim().length < 3) return toast.error("Title is too short");
    if (!company.trim()) return toast.error("Company / organization is required");
    if (description.trim().length < 10) return toast.error("Description is too short");
    if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return toast.error("A valid contact email is required");
    if (applyUrl.trim() && !/^https?:\/\//i.test(applyUrl.trim())) return toast.error("Apply link must start with http(s)://");
    if (companyWebsite.trim() && !/^https?:\/\//i.test(companyWebsite.trim())) return toast.error("Company website must start with http(s)://");
    if (kind === "paid_ad" && !adBudget) return toast.error("Paid ads require a budget");

    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    setSaving(true);
    const { error } = await supabase.from("posting_submissions").insert({
      submitter_id: profile.id,
      kind,
      title: title.trim(),
      company: company.trim(),
      company_website: companyWebsite.trim() || null,
      description: description.trim(),
      requirements: requirements.trim() || null,
      benefits: benefits.trim() || null,
      location: location.trim() || null,
      is_remote: isRemote,
      is_paid: isPaid,
      compensation: compensation.trim() || null,
      salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null,
      experience_level: kind === "employment" && experience ? experience : null,
      duration_months: kind === "internship" && duration ? Number(duration) : null,
      stipend_amount: kind === "internship" && stipend ? Number(stipend) : null,
      apply_url: applyUrl.trim() || null,
      apply_email: applyEmail.trim() || null,
      deadline: deadline || null,
      tags,
      ad_budget_cents: kind === "paid_ad" && adBudget ? Math.round(Number(adBudget) * 100) : null,
      ad_duration_days: kind === "paid_ad" && adDays ? Number(adDays) : null,
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted! UiPair will review and publish it.");
    onSubmitted();
  };

  const kinds: { value: SubmissionKind; label: string; icon: React.ReactNode; hint: string }[] = [
    { value: "job", label: "Job", icon: <Briefcase className="h-4 w-4" />, hint: "Generic role" },
    { value: "internship", label: "Internship", icon: <GraduationCap className="h-4 w-4" />, hint: "Duration · stipend" },
    { value: "employment", label: "Employment", icon: <Briefcase className="h-4 w-4" />, hint: "Salary · seniority" },
    { value: "paid_ad", label: "Paid Ad", icon: <Megaphone className="h-4 w-4" />, hint: "Promote your brand" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a posting to UiPair</DialogTitle>
          <DialogDescription>
            Fill out the form and the UiPair team will review your submission. Approved postings appear on the Jobs board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">What are you submitting?</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kinds.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "rounded-md border p-2 text-left transition",
                    kind === k.value ? "border-primary bg-primary/5" : "hover:bg-accent",
                  )}
                >
                  <p className="text-sm font-semibold inline-flex items-center gap-1.5">{k.icon} {k.label}</p>
                  <p className="text-[10px] text-muted-foreground">{k.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "paid_ad" ? "Your ad headline" : "e.g. Marketing Intern"} />
            </div>
            <div>
              <Label>{kind === "paid_ad" ? "Brand / company *" : "Company *"}</Label>
              <Input maxLength={150} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label>Company website</Label>
              <Input type="url" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <Label>Description *</Label>
              <Textarea rows={4} maxLength={8000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {kind !== "paid_ad" && (
              <>
                <div className="col-span-2">
                  <Label>Requirements</Label>
                  <Textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Benefits / perks</Label>
                  <Textarea rows={2} value={benefits} onChange={(e) => setBenefits(e.target.value)} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="inline-flex items-center gap-2 text-sm"><Switch checked={isRemote} onCheckedChange={setIsRemote} /> Remote</label>
                  <label className="inline-flex items-center gap-2 text-sm"><Switch checked={isPaid} onCheckedChange={setIsPaid} /> Paid</label>
                </div>
              </>
            )}

            {kind === "employment" && (
              <>
                <div>
                  <Label>Seniority</Label>
                  <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceLevel)}>
                    <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(EXPERIENCE_LABEL) as ExperienceLevel[]).map((l) => (
                        <SelectItem key={l} value={l}>{EXPERIENCE_LABEL[l]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Compensation (free text)</Label>
                  <Input value={compensation} onChange={(e) => setCompensation(e.target.value)} placeholder="$60–80k / year" />
                </div>
                <div>
                  <Label>Salary min</Label>
                  <Input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
                </div>
                <div>
                  <Label>Salary max</Label>
                  <Input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
                </div>
              </>
            )}

            {kind === "internship" && (
              <>
                <div>
                  <Label>Duration (months)</Label>
                  <Input type="number" min={1} max={36} value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div>
                  <Label>Stipend / month</Label>
                  <Input type="number" min={0} value={stipend} onChange={(e) => setStipend(e.target.value)} />
                </div>
              </>
            )}

            {kind === "paid_ad" && (
              <>
                <div>
                  <Label>Ad budget (USD) *</Label>
                  <Input type="number" min={0} value={adBudget} onChange={(e) => setAdBudget(e.target.value)} placeholder="500" />
                </div>
                <div>
                  <Label>Run for (days)</Label>
                  <Input type="number" min={1} value={adDays} onChange={(e) => setAdDays(e.target.value)} placeholder="14" />
                </div>
              </>
            )}

            {kind !== "paid_ad" && (
              <>
                <div>
                  <Label>Apply URL</Label>
                  <Input type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} />
                </div>
                <div>
                  <Label>…or Apply email</Label>
                  <Input type="email" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Deadline</Label>
                  <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="Python, Remote, Lagos" />
                </div>
              </>
            )}

            <div className="col-span-2 border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Contact info — so UiPair can reach you</p>
            </div>
            <div>
              <Label>Contact email *</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+254…" />
            </div>
            <div className="col-span-2">
              <Label>Anything else?</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the UiPair review team" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit for review"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
