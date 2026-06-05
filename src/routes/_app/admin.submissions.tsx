import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ShieldCheck, Check, X, Megaphone, GraduationCap, Briefcase, Building2,
  MapPin, Calendar, Clock, Mail, Phone, ExternalLink, ArrowLeft, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/submissions")({
  component: AdminSubmissionsPage,
  head: () => ({ meta: [{ title: "Submissions · UiPair Admin" }] }),
});

type Kind = "job" | "internship" | "employment" | "paid_ad";
type Status = "pending" | "approved" | "rejected" | "published";

type Submission = {
  id: string;
  submitter_id: string;
  kind: Kind;
  title: string;
  company: string;
  company_website: string | null;
  company_logo_url: string | null;
  description: string;
  requirements: string | null;
  benefits: string | null;
  location: string | null;
  is_remote: boolean;
  is_paid: boolean;
  compensation: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  experience_level: string | null;
  duration_months: number | null;
  stipend_amount: number | null;
  apply_url: string | null;
  apply_email: string | null;
  deadline: string | null;
  tags: string[];
  ad_budget_cents: number | null;
  ad_duration_days: number | null;
  contact_email: string;
  contact_phone: string | null;
  notes: string | null;
  status: Status;
  review_notes: string | null;
  reviewed_at: string | null;
  published_posting_id: string | null;
  created_at: string;
};

const KIND_META: Record<Kind, { label: string; icon: React.ReactNode; chip: string }> = {
  job: { label: "Job", icon: <Briefcase className="h-3.5 w-3.5" />, chip: "bg-slate-100 text-slate-700 border-slate-200" },
  internship: { label: "Internship", icon: <GraduationCap className="h-3.5 w-3.5" />, chip: "bg-blue-100 text-blue-700 border-blue-200" },
  employment: { label: "Employment", icon: <Briefcase className="h-3.5 w-3.5" />, chip: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  paid_ad: { label: "Paid Ad", icon: <Megaphone className="h-3.5 w-3.5" />, chip: "bg-amber-100 text-amber-700 border-amber-200" },
};

const STATUS_CHIP: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
};

function AdminSubmissionsPage() {
  const { profile } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [items, setItems] = useState<Submission[]>([]);
  const [submitters, setSubmitters] = useState<Record<string, { full_name: string | null; username: string | null; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pending");
  const [active, setActive] = useState<Submission | null>(null);
  const [rejectFor, setRejectFor] = useState<Submission | null>(null);

  useEffect(() => {
    if (!profile?.id) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", profile.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [profile?.id]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posting_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (data ?? []) as Submission[];
    setItems(list);
    const ids = Array.from(new Set(list.map((s) => s.submitter_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", ids);
      setSubmitters(Object.fromEntries((profs ?? []).map((p) => [p.id, p])));
    }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const counts = useMemo(() => ({
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    published: items.filter((i) => i.status === "published").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  }), [items]);

  const filtered = items.filter((i) => i.status === tab);

  if (isAdmin === null) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Checking permissions…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-3">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">UiPair admin only</h1>
        <p className="text-sm text-muted-foreground">This dashboard is restricted to the UiPair platform team.</p>
        <Button asChild variant="outline"><Link to="/gigs"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
      </div>
    );
  }

  const approveAndPublish = async (s: Submission) => {
    if (!profile) return;
    const category: "internship" | "employment" =
      s.kind === "internship" ? "internship" : s.kind === "employment" ? "employment" : "employment";
    const jobType =
      s.kind === "internship" ? "internship" :
      s.kind === "employment" ? "full_time" : "full_time";

    const { data: posting, error: pErr } = await supabase
      .from("job_postings")
      .insert({
        poster_id: profile.id,
        title: s.title,
        company: s.company,
        company_website: s.company_website,
        company_logo_url: s.company_logo_url,
        description: s.description,
        requirements: s.requirements,
        benefits: s.benefits,
        job_type: jobType,
        category,
        location: s.location,
        is_remote: s.is_remote,
        is_paid: s.is_paid,
        compensation: s.compensation,
        apply_url: s.apply_url,
        apply_email: s.apply_email,
        deadline: s.deadline,
        tags: s.tags,
        experience_level: s.experience_level,
        salary_min: s.salary_min,
        salary_max: s.salary_max,
        salary_currency: s.salary_currency ?? "USD",
        salary_period: s.salary_period,
        duration_months: s.duration_months,
        stipend_amount: s.stipend_amount,
      })
      .select("id")
      .single();

    if (pErr) return toast.error(pErr.message);

    const { error: uErr } = await supabase
      .from("posting_submissions")
      .update({
        status: "published",
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        published_posting_id: posting!.id,
      })
      .eq("id", s.id);
    if (uErr) return toast.error(uErr.message);

    toast.success("Approved & published");
    setActive(null);
    load();
  };

  const approveOnly = async (s: Submission) => {
    if (!profile) return;
    const { error } = await supabase
      .from("posting_submissions")
      .update({
        status: "approved",
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Marked as approved");
    setActive(null);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold inline-flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" /> Submission queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Review, approve and publish jobs, internships, employment and paid-ad submissions.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="published">Published ({counts.published})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 pt-3">
          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Loading submissions…</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No {tab} submissions.
            </Card>
          ) : (
            filtered.map((s) => {
              const submitter = submitters[s.submitter_id];
              return (
                <Card key={s.id} className="flex flex-wrap items-start gap-4 p-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("gap-1 text-[10px]", KIND_META[s.kind].chip)}>
                        {KIND_META[s.kind].icon} {KIND_META[s.kind].label}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_CHIP[s.status])}>{s.status}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="truncate text-sm font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {s.company}
                      {s.location && <> · <MapPin className="h-3 w-3" /> {s.location}</>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      From {submitter?.full_name ?? submitter?.username ?? "Unknown"} · {s.contact_email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setActive(s)}>Review</Button>
                    {s.status === "pending" && (
                      <>
                        <Button size="sm" className="gap-1" onClick={() => approveAndPublish(s)}>
                          <Check className="h-3.5 w-3.5" /> Publish
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setRejectFor(s)}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </>
                    )}
                    {s.status === "approved" && (
                      <Button size="sm" className="gap-1" onClick={() => approveAndPublish(s)}>
                        <Check className="h-3.5 w-3.5" /> Publish
                      </Button>
                    )}
                    {s.status === "published" && s.published_posting_id && (
                      <Button asChild size="sm" variant="outline" className="gap-1">
                        <Link to="/jobs/$jobId" params={{ jobId: s.published_posting_id }}>
                          View <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <ReviewSheet
        submission={active}
        onClose={() => setActive(null)}
        onApprovePublish={approveAndPublish}
        onApproveOnly={approveOnly}
        onReject={(s) => { setActive(null); setRejectFor(s); }}
      />
      <RejectDialog
        submission={rejectFor}
        onClose={() => setRejectFor(null)}
        onDone={() => { setRejectFor(null); load(); }}
        reviewerId={profile?.id ?? null}
      />
    </div>
  );
}

function ReviewSheet({
  submission, onClose, onApprovePublish, onApproveOnly, onReject,
}: {
  submission: Submission | null;
  onClose: () => void;
  onApprovePublish: (s: Submission) => void;
  onApproveOnly: (s: Submission) => void;
  onReject: (s: Submission) => void;
}) {
  if (!submission) return null;
  const s = submission;
  const salary = s.salary_min || s.salary_max
    ? `${s.salary_currency ?? "USD"} ${s.salary_min?.toLocaleString() ?? "?"}${s.salary_max ? `–${s.salary_max.toLocaleString()}` : ""}${s.salary_period ? `/${s.salary_period}` : ""}`
    : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("gap-1 text-[10px]", KIND_META[s.kind].chip)}>
              {KIND_META[s.kind].icon} {KIND_META[s.kind].label}
            </Badge>
            <span>{s.title}</span>
          </DialogTitle>
          <DialogDescription>
            {s.company} · submitted {new Date(s.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(s.location || s.is_remote) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.is_remote ? (s.location ? `${s.location} · Remote` : "Remote") : s.location}</span>}
            {s.deadline && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Apply by {new Date(s.deadline).toLocaleDateString()}</span>}
            {s.duration_months && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration_months} months</span>}
            <span>{s.is_paid ? "Paid" : "Unpaid"}</span>
          </div>

          {(salary || s.compensation || s.stipend_amount) && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Compensation</p>
              <p className="font-medium text-emerald-700">
                {salary ?? s.compensation ?? `${s.salary_currency ?? "USD"} ${s.stipend_amount?.toLocaleString()}/mo stipend`}
              </p>
            </div>
          )}

          {s.kind === "paid_ad" && (
            <div className="rounded-md border bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold uppercase text-amber-800">Paid ad request</p>
              <p>Budget: <span className="font-medium">${((s.ad_budget_cents ?? 0) / 100).toLocaleString()}</span></p>
              {s.ad_duration_days && <p>Run for: <span className="font-medium">{s.ad_duration_days} days</span></p>}
            </div>
          )}

          <section>
            <h3 className="mb-1 font-semibold">Description</h3>
            <p className="whitespace-pre-wrap text-foreground/90">{s.description}</p>
          </section>

          {s.requirements && (
            <section>
              <h3 className="mb-1 font-semibold">Requirements</h3>
              <p className="whitespace-pre-wrap text-foreground/90">{s.requirements}</p>
            </section>
          )}
          {s.benefits && (
            <section>
              <h3 className="mb-1 font-semibold">Benefits</h3>
              <p className="whitespace-pre-wrap text-foreground/90">{s.benefits}</p>
            </section>
          )}

          {s.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {s.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
            </div>
          )}

          <div className="rounded-md border p-3 text-xs space-y-1">
            <p className="font-semibold uppercase text-muted-foreground">Contact</p>
            <p className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {s.contact_email}</p>
            {s.contact_phone && <p className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {s.contact_phone}</p>}
            {s.apply_url && <p className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> {s.apply_url}</p>}
            {s.apply_email && <p className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> Apply: {s.apply_email}</p>}
            {s.company_website && <p className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> {s.company_website}</p>}
          </div>

          {s.notes && (
            <div className="rounded-md border border-dashed p-3 text-xs">
              <p className="font-semibold uppercase text-muted-foreground">Notes from submitter</p>
              <p className="mt-1 whitespace-pre-wrap">{s.notes}</p>
            </div>
          )}

          {s.review_notes && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs">
              <p className="font-semibold uppercase text-rose-700">Review notes</p>
              <p className="mt-1 whitespace-pre-wrap text-rose-900">{s.review_notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {s.status === "pending" && (
            <>
              <Button variant="ghost" className="text-destructive" onClick={() => onReject(s)}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button variant="outline" onClick={() => onApproveOnly(s)}>Mark approved</Button>
            </>
          )}
          {(s.status === "pending" || s.status === "approved") && (
            <Button onClick={() => onApprovePublish(s)} className="gap-1">
              <Check className="h-4 w-4" /> Approve & Publish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  submission, onClose, onDone, reviewerId,
}: {
  submission: Submission | null;
  onClose: () => void;
  onDone: () => void;
  reviewerId: string | null;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setNote(""); }, [submission?.id]);
  if (!submission) return null;

  const reject = async () => {
    if (note.trim().length < 5) return toast.error("Add a brief reason (min 5 characters)");
    setSaving(true);
    const { error } = await supabase.from("posting_submissions").update({
      status: "rejected",
      review_notes: note.trim(),
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", submission.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Submission rejected");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject submission</DialogTitle>
          <DialogDescription>
            Tell the submitter why so they can revise and resubmit.
          </DialogDescription>
        </DialogHeader>
        <Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We need more detail about the role and compensation." />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={reject} disabled={saving}>{saving ? "Rejecting…" : "Reject"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
