import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { SUBJECTS, addCustomSubject, canonicalSubject, normalizeSubject } from "@/lib/subjects";
import { useAllSubjects } from "@/lib/use-all-subjects";
import { DegreeQuickPicks } from "@/components/peerly/DegreeQuickPicks";
import { DegreePicker } from "@/components/peerly/DegreePicker";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLocation } from "@/lib/normalize-location";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/circles/new")({
  component: CreateCirclePage,
  head: () => ({
    meta: [
      { title: "Create a Study Circle · UiPair" },
      { name: "description", content: "Start a new study circle and invite peers" },
    ],
  }),
});

function CreateCirclePage() {
  const allSubjects = useAllSubjects();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [degree, setDegree] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [campusOnly, setCampusOnly] = useState(false);
  const [isPremium, setIsPremium] = useState(true);
  const [price, setPrice] = useState("4.99");
  const [schedule, setSchedule] = useState("");
  const [resourcesUrl, setResourcesUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const premiumLocked = !campusOnly;
  const effectivePremium = premiumLocked ? true : isPremium;

  const handleSubmit = async () => {
    console.log("[circles/new] submit clicked", { user: user?.id, name, subject });
    if (!user) {
      toast.error("Please sign in");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter a name for your circle");
      return;
    }
    const isOther = subject === "Other";
    const customNorm = isOther ? normalizeSubject(customSubject) : "";
    if (isOther && !customNorm) {
      toast.error("Please enter a custom subject");
      return;
    }

    // Persist canonical custom subject (dedup + normalize) and reuse if it matches a known one.
    let finalSubject = subject;
    let finalCustom: string | null = null;
    if (isOther) {
      const canonical = canonicalSubject(customNorm);
      const builtin = (SUBJECTS as readonly string[]).find((s) => s.toLowerCase() === canonical.toLowerCase());
      if (builtin) {
        finalSubject = builtin;
      } else {
        addCustomSubject(canonical);
        finalCustom = canonical;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        subject: finalSubject,
        custom_subject: finalCustom,
        degree,
        description: description.trim() || null,
        leader_id: user.id,
        scope: campusOnly ? ("campus" as const) : ("global" as const),
        university: campusOnly ? normalizeLocation(profile?.university) : null,
        is_premium: effectivePremium,
        price_monthly: effectivePremium ? Number(price) : null,
        meeting_schedule: schedule.trim() || null,
        resources_folder_url: resourcesUrl.trim() || null,
      };
      console.log("[circles/new] inserting", payload);
      const { data, error } = await supabase
        .from("circles")
        .insert(payload)
        .select("id")
        .single();
      console.log("[circles/new] insert result", { data, error });
      if (error || !data) {
        toast.error(error?.message ?? "Failed to create circle");
        return;
      }
      toast.success("Circle created!");
      navigate({ to: "/circles/$circleId", params: { circleId: data.id } });
    } catch (err) {
      console.error("[circles/new] unexpected error", err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please sign in to create a circle.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/circles"><ArrowLeft className="h-4 w-4" /> Back to circles</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Create a Study Circle</h1>
        <p className="text-sm text-muted-foreground">Build a focused space for peers to learn together.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <Label>Circle name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Algorithms Deep Dive" maxLength={80} />
        </div>
        <div>
          <Label>Subject</Label>
          <Input
            list="subject-suggestions"
            value={subject === "Other" ? customSubject : subject}
            onChange={(e) => {
              const val = e.target.value.trimStart();
              const known = allSubjects.some((s) => s.toLowerCase() === val.toLowerCase());
              if (known) {
                const matched = allSubjects.find((s) => s.toLowerCase() === val.toLowerCase())!;
                setSubject(matched);
                setCustomSubject("");
              } else {
                setSubject("Other");
                setCustomSubject(val);
              }
            }}
            placeholder="Type or pick a subject…"
            maxLength={80}
          />
          <datalist id="subject-suggestions">
            {allSubjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <DegreeQuickPicks value={subject} onSelect={(s) => { setSubject(s); setCustomSubject(""); }} />
          <DegreePicker value={degree} onChange={setDegree} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={500} placeholder="What will this circle focus on?" />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Campus only</p>
            <p className="text-xs text-muted-foreground">
              Restrict to students from {profile?.university || "your university"}
            </p>
          </div>
          <Switch checked={campusOnly} onCheckedChange={setCampusOnly} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Premium circle</p>
            <p className="text-xs text-muted-foreground">
              {premiumLocked
                ? "Global circles require a monthly subscription to join"
                : "Charge a monthly subscription"}
            </p>
          </div>
          <Switch checked={effectivePremium} onCheckedChange={setIsPremium} disabled={premiumLocked} />
        </div>
        {effectivePremium && (
          <div>
            <Label>Price per month (USD)</Label>
            <Input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        )}
        <div>
          <Label>Meeting schedule</Label>
          <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="e.g. Tuesdays 7pm UTC" maxLength={120} />
        </div>
        <div>
          <Label>Resources folder URL</Label>
          <Input value={resourcesUrl} onChange={(e) => setResourcesUrl(e.target.value)} placeholder="Drive / Notion link (optional)" />
        </div>
        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? "Creating…" : "Create circle"}
        </Button>
      </Card>
    </div>
  );
}
