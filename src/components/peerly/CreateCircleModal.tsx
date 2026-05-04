import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECTS } from "@/lib/subjects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function CreateCircleModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [description, setDescription] = useState("");
  const [campusOnly, setCampusOnly] = useState(false);
  // Global circles are premium-paid by default; campus circles are free unless toggled.
  const [isPremium, setIsPremium] = useState(true);
  const [price, setPrice] = useState("4.99");
  // When global, premium is enforced (cannot be turned off).
  const premiumLocked = !campusOnly;
  const effectivePremium = premiumLocked ? true : isPremium;
  const [schedule, setSchedule] = useState("");
  const [resourcesUrl, setResourcesUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(""); setDescription(""); setCampusOnly(false); setIsPremium(true);
    setPrice("4.99"); setSchedule(""); setResourcesUrl("");
  };

  const handleSubmit = async () => {
    if (!user || !name.trim() || !subject) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("circles")
      .insert({
        name: name.trim(),
        subject,
        description: description.trim() || null,
        leader_id: user.id,
        scope: campusOnly ? "campus" : "global",
        university: campusOnly ? profile?.university ?? null : null,
        is_premium: effectivePremium,
        price_monthly: effectivePremium ? Number(price) : null,
        meeting_schedule: schedule.trim() || null,
        resources_folder_url: resourcesUrl.trim() || null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create circle");
      return;
    }
    toast.success("Circle created!");
    reset();
    onOpenChange(false);
    navigate({ to: "/circles/$circleId", params: { circleId: data.id } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a Study Circle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Circle Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Algorithms Deep Dive" maxLength={80} />
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} placeholder="What will this circle focus on?" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Campus only</p>
              <p className="text-xs text-muted-foreground">Restrict to students from {profile?.university || "your university"}</p>
            </div>
            <Switch checked={campusOnly} onCheckedChange={setCampusOnly} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Premium circle</p>
              <p className="text-xs text-muted-foreground">Charge a monthly subscription</p>
            </div>
            <Switch checked={isPremium} onCheckedChange={setIsPremium} />
          </div>
          {isPremium && (
            <div>
              <Label>Price per month (USD)</Label>
              <Input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Meeting Schedule</Label>
            <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="e.g. Tuesdays 7pm UTC" maxLength={120} />
          </div>
          <div>
            <Label>Resources folder URL</Label>
            <Input value={resourcesUrl} onChange={(e) => setResourcesUrl(e.target.value)} placeholder="Drive / Notion link (optional)" />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()} className="w-full">
            {submitting ? "Creating…" : "Create Circle"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
