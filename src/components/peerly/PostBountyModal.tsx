import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECTS } from "@/lib/subjects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function PostBountyModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [reward, setReward] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user || !title.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("bounties").insert({
      poster_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      subject,
      reward_cents: Math.round(reward * 100),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Bounty posted!");
    setTitle(""); setDescription(""); setReward(8);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Post a Bounty</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Need help with linear algebra proof" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reward ($)</Label>
              <Input type="number" min={1} value={reward} onChange={(e) => setReward(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Button onClick={submit} disabled={submitting || !title.trim()} className="w-full">
            {submitting ? "Posting…" : "Post Bounty"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
