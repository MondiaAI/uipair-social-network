import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_ROLES, ROLE_LABEL, type ProjectRole } from "@/lib/project-meta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function ApplyToProjectModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  defaultRoles,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string | null;
  projectName: string;
  defaultRoles?: ProjectRole[];
}) {
  const { user } = useAuth();
  const [role, setRole] = useState<ProjectRole>(defaultRoles?.[0] ?? "other");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !projectId) return;
    setSubmitting(true);
    const { error } = await supabase.from("project_applications").insert({
      project_id: projectId,
      applicant_id: user.id,
      desired_role: role,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "You already applied to this project" : error.message);
      return;
    }
    toast.success("Application sent!");
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to {projectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Role you want</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Why are you a good fit?</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={400}
              placeholder="Briefly share your skills and what you'd contribute…"
            />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "Sending…" : "Send Application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
