import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Briefcase, Lock, MapPin, Plus, ExternalLink, Search, Calendar, Building2, Sparkles } from "lucide-react";
import { ProUpgradeModal } from "@/components/peerly/ProUpgradeModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type JobType = "internship" | "full_time" | "part_time" | "contract" | "volunteer";

type JobPosting = {
  id: string;
  poster_id: string;
  title: string;
  company: string;
  description: string;
  job_type: JobType;
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
};

type Application = {
  id: string;
  job_id: string;
  status: "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
  note: string | null;
  updated_at: string;
};

const JOB_TYPE_LABEL: Record<JobType, string> = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  volunteer: "Volunteer",
};

const JOB_TYPE_CHIP: Record<JobType, string> = {
  internship: "bg-blue-100 text-blue-700 border-blue-200",
  full_time: "bg-emerald-100 text-emerald-700 border-emerald-200",
  part_time: "bg-amber-100 text-amber-700 border-amber-200",
  contract: "bg-purple-100 text-purple-700 border-purple-200",
  volunteer: "bg-rose-100 text-rose-700 border-rose-200",
};

const STATUS_LABEL: Record<Application["status"], string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const FILTER_TYPES: (JobType | "all")[] = ["all", "internship", "full_time", "part_time", "contract", "volunteer"];

export function JobsDashboard() {
  const { profile } = useAuth();
  const isPremium = !!profile?.is_pro;
  const currentYear = new Date().getFullYear();
  const [gradYear, setGradYear] = useState<number | null>(null);
  const isVerifiedAlum = !!profile?.is_verified && !!gradYear && gradYear <= currentYear;
  const canPost = isPremium && isVerifiedAlum;

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [posters, setPosters] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [paidOnly, setPaidOnly] = useState(false);

  const loadData = async () => {
    if (!isPremium) return;
    setLoading(true);
    const [{ data: jobsData }, { data: appsData }] = await Promise.all([
      supabase.from("job_postings").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(100),
      profile ? supabase.from("job_applications").select("*").order("updated_at", { ascending: false }) : Promise.resolve({ data: [] as Application[] }),
    ]);
    const list = (jobsData ?? []) as JobPosting[];
    setJobs(list);
    setApps((appsData ?? []) as Application[]);
    const ids = Array.from(new Set(list.map((j) => j.poster_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids);
      setPosters(Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }])));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, profile?.id]);

  useEffect(() => {
    if (!profile?.id) { setGradYear(null); return; }
    supabase.from("profiles").select("graduation_year").eq("id", profile.id).maybeSingle()
      .then(({ data }) => setGradYear((data as { graduation_year: number | null } | null)?.graduation_year ?? null));
  }, [profile?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (typeFilter !== "all" && j.job_type !== typeFilter) return false;
      if (remoteOnly && !j.is_remote) return false;
      if (paidOnly && !j.is_paid) return false;
      if (!term) return true;
      return (
        j.title.toLowerCase().includes(term) ||
        j.company.toLowerCase().includes(term) ||
        (j.location ?? "").toLowerCase().includes(term) ||
        j.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [jobs, search, typeFilter, remoteOnly, paidOnly]);

  const appByJobId = useMemo(() => {
    const m: Record<string, Application> = {};
    for (const a of apps) m[a.job_id] = a;
    return m;
  }, [apps]);

  const trackedJobs = useMemo(() => {
    const ids = new Set(apps.map((a) => a.job_id));
    return jobs.filter((j) => ids.has(j.id));
  }, [apps, jobs]);

  const setStatus = async (jobId: string, status: Application["status"]) => {
    if (!profile) return;
    const existing = appByJobId[jobId];
    if (existing) {
      const { error } = await supabase.from("job_applications").update({ status }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("job_applications").insert({ job_id: jobId, user_id: profile.id, status });
      if (error) return toast.error(error.message);
    }
    toast.success(`Marked as ${STATUS_LABEL[status]}`);
    loadData();
  };

  const removeTracking = async (jobId: string) => {
    const existing = appByJobId[jobId];
    if (!existing) return;
    const { error } = await supabase.from("job_applications").delete().eq("id", existing.id);
    if (error) return toast.error(error.message);
    loadData();
  };

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
                Browse curated internships and jobs posted by verified alumni from top universities — available to Premium members only.
              </p>
            </div>
            <ul className="mx-auto max-w-sm space-y-1 text-left text-sm text-muted-foreground">
              <li>✓ Verified alumni postings — no spam</li>
              <li>✓ Track applications from saved → offer</li>
              <li>✓ Filter by remote, paid, internship vs full-time</li>
            </ul>
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
            Opportunities posted by verified alumni — exclusively for Premium members.
          </p>
        </div>
        <Button
          onClick={() => (canPost ? setShowPost(true) : toast.info("Only verified alumni (with a past graduation year) can post jobs."))}
          variant={canPost ? "default" : "outline"}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Post a Job
        </Button>
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="tracker">My Tracker ({apps.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4 pt-3">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, company, location, tag…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  {t === "all" ? "All types" : JOB_TYPE_LABEL[t]}
                </button>
              ))}
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
              No postings match your filters yet.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((j) => (
                <JobCard
                  key={j.id}
                  job={j}
                  poster={posters[j.poster_id]}
                  application={appByJobId[j.id]}
                  onStatus={setStatus}
                  onRemove={removeTracking}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tracker" className="space-y-3 pt-3">
          {trackedJobs.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              Save or apply to jobs to build your tracker.
            </Card>
          ) : (
            <div className="space-y-3">
              {trackedJobs.map((j) => (
                <JobCard
                  key={j.id}
                  job={j}
                  poster={posters[j.poster_id]}
                  application={appByJobId[j.id]}
                  onStatus={setStatus}
                  onRemove={removeTracking}
                  compact
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PostJobDialog
        open={showPost}
        onOpenChange={setShowPost}
        canPost={canPost}
        onCreated={() => { setShowPost(false); loadData(); }}
      />
    </div>
  );
}

function JobCard({
  job, poster, application, onStatus, onRemove, compact,
}: {
  job: JobPosting;
  poster?: { full_name: string | null; avatar_url: string | null };
  application?: Application;
  onStatus: (id: string, s: Application["status"]) => void;
  onRemove: (id: string) => void;
  compact?: boolean;
}) {
  const applyHref = job.apply_url ?? (job.apply_email ? `mailto:${job.apply_email}` : null);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{job.title}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" /> {job.company}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px]", JOB_TYPE_CHIP[job.job_type])}>
          {JOB_TYPE_LABEL[job.job_type]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {(job.location || job.is_remote) && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.is_remote ? (job.location ? `${job.location} · Remote` : "Remote") : job.location}
          </span>
        )}
        <span>{job.is_paid ? "Paid" : "Unpaid"}</span>
        {job.compensation && <span className="font-medium text-emerald-600">{job.compensation}</span>}
        {job.deadline && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Apply by {new Date(job.deadline).toLocaleDateString()}
          </span>
        )}
      </div>

      {!compact && <p className="line-clamp-3 text-xs text-muted-foreground">{job.description}</p>}

      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.tags.slice(0, 6).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-2 border-t pt-2">
        {poster?.full_name && (
          <span className="text-[11px] text-muted-foreground">Posted by {poster.full_name}</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={application?.status ?? "none"}
            onValueChange={(v) => {
              if (v === "none") onRemove(job.id);
              else onStatus(job.id, v as Application["status"]);
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Track…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not tracking</SelectItem>
              {(Object.keys(STATUS_LABEL) as Application["status"][]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {applyHref ? (
            <Button asChild size="sm" className="gap-1">
              <a href={applyHref} target="_blank" rel="noopener noreferrer" onClick={() => !application && onStatus(job.id, "applied")}>
                Apply <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : (
            <Button size="sm" disabled>No apply link</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function PostJobDialog({
  open, onOpenChange, canPost, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canPost: boolean;
  onCreated: () => void;
}) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState<JobType>("internship");
  const [location, setLocation] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [compensation, setCompensation] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(""); setCompany(""); setDescription(""); setJobType("internship");
    setLocation(""); setIsRemote(false); setIsPaid(true); setCompensation("");
    setApplyUrl(""); setApplyEmail(""); setDeadline(""); setTagsRaw("");
  };

  const submit = async () => {
    if (!profile) return;
    if (title.trim().length < 3) return toast.error("Title must be at least 3 characters");
    if (!company.trim()) return toast.error("Company is required");
    if (description.trim().length < 10) return toast.error("Description must be at least 10 characters");
    if (!applyUrl.trim() && !applyEmail.trim()) return toast.error("Provide an apply link or apply email");
    if (applyUrl.trim() && !/^https?:\/\//i.test(applyUrl.trim())) return toast.error("Apply link must start with http(s)://");
    if (applyEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyEmail.trim())) return toast.error("Apply email is invalid");

    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    setSaving(true);
    const { error } = await supabase.from("job_postings").insert({
      poster_id: profile.id,
      title: title.trim(),
      company: company.trim(),
      description: description.trim(),
      job_type: jobType,
      location: location.trim() || null,
      is_remote: isRemote,
      is_paid: isPaid,
      compensation: compensation.trim() || null,
      apply_url: applyUrl.trim() || null,
      apply_email: applyEmail.trim() || null,
      deadline: deadline || null,
      tags,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Job posted");
    reset();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a Job or Internship</DialogTitle>
        </DialogHeader>

        {!canPost ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Posting is limited to <strong>Premium + verified alumni</strong> (a past graduation year on your profile).
            Update your profile and complete verification to unlock posting.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="job-title">Title *</Label>
                <Input id="job-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software Engineering Intern" />
              </div>
              <div>
                <Label htmlFor="job-company">Company *</Label>
                <Input id="job-company" maxLength={150} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc" />
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={jobType} onValueChange={(v) => setJobType(v as JobType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(JOB_TYPE_LABEL) as JobType[]).map((t) => (
                      <SelectItem key={t} value={t}>{JOB_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="job-location">Location</Label>
                <Input id="job-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairobi, Kenya" />
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="inline-flex items-center gap-2 text-sm"><Switch checked={isRemote} onCheckedChange={setIsRemote} /> Remote</label>
                <label className="inline-flex items-center gap-2 text-sm"><Switch checked={isPaid} onCheckedChange={setIsPaid} /> Paid</label>
              </div>
              <div className="col-span-2">
                <Label htmlFor="job-comp">Compensation (optional)</Label>
                <Input id="job-comp" value={compensation} onChange={(e) => setCompensation(e.target.value)} placeholder="$25/hr · $1,200/mo · Equity" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="job-desc">Description *</Label>
                <Textarea id="job-desc" rows={5} maxLength={8000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Role, expectations, who you're looking for…" />
              </div>
              <div>
                <Label htmlFor="job-url">Apply URL</Label>
                <Input id="job-url" type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <Label htmlFor="job-email">…or Email</Label>
                <Input id="job-email" type="email" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)} placeholder="careers@acme.com" />
              </div>
              <div>
                <Label htmlFor="job-deadline">Deadline</Label>
                <Input id="job-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="job-tags">Tags (comma-separated)</Label>
                <Input id="job-tags" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="React, Python, Marketing" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canPost || saving}>{saving ? "Posting…" : "Post job"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
