import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECTS } from "@/lib/subjects";
import { useAllSubjects } from "@/lib/use-all-subjects";
import { addCustomSubject } from "@/lib/subjects";
import { DegreeQuickPicks } from "@/components/peerly/DegreeQuickPicks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  partnerName: string;
  defaultSubject?: string;
}

export function StudyTogetherModal({ open, onOpenChange, partnerId, partnerName, defaultSubject }: Props) {
  const { user } = useAuth();
  const [subject, setSubject] = useState(defaultSubject ?? SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [proposedAt, setProposedAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = useState(60);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (subject === "Other" && !customSubject.trim()) {
      toast.error("Please enter a custom subject");
      return;
    }
    setLoading(true);
    const finalSubject = subject === "Other" ? customSubject.trim() : subject;
    const { error } = await supabase.from("study_requests").insert({
      sender_id: user.id,
      recipient_id: partnerId,
      subject: finalSubject,
      message: message || null,
      proposed_at: new Date(proposedAt).toISOString(),
      duration_minutes: duration,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Request sent to ${partnerName}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Study with {partnerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {useAllSubjectsList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <DegreeQuickPicks value={subject} onSelect={setSubject} />
            {subject === "Other" && (
              <Input
                className="mt-2"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Enter custom subject"
                maxLength={50}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>When</Label>
              <Input type="datetime-local" value={proposedAt} onChange={(e) => setProposedAt(e.target.value)} />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What do you want to study?" rows={3} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Sending..." : "Send Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
