import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Search } from "lucide-react";
import { useNetworkPeople } from "@/hooks/use-network-people";
import { SUBJECTS } from "@/lib/subjects";
import {
  PROJECT_CATEGORIES,
  PROJECT_ROLES,
  CATEGORY_LABEL,
  ROLE_LABEL,
  ROLE_CHIP,
  type ProjectCategory,
  type ProjectRole,
} from "@/lib/project-meta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CreateProjectModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [category, setCategory] = useState<ProjectCategory>("other");
  const [openRoles, setOpenRoles] = useState<ProjectRole[]>([]);
  const [teamSize, setTeamSize] = useState(5);
  const [deadline, setDeadline] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const toggleRole = (r: ProjectRole) =>
    setOpenRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const reset = () => {
    setName(""); setDescription(""); setCategory("other"); setOpenRoles([]);
    setTeamSize(5); setDeadline(""); setIsPublic(true);
  };

  const handleSubmit = async () => {
    if (!user || !name.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        creator_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        subject,
        category,
        open_roles: openRoles,
        team_size_limit: teamSize,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        is_public: isPublic,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create project");
      return;
    }
    toast.success("Project created!");
    reset();
    onOpenChange(false);
    navigate({ to: "/lab/$projectId", params: { projectId: data.id } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Project Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. AI Tutor for Calculus" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Subject Area</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProjectCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Open Roles Needed</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROJECT_ROLES.map((r) => {
                const active = openRoles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={cn(
                      "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                      active ? ROLE_CHIP[r] : "bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Team Size Limit</Label>
              <Input type="number" min={2} max={50} value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value) || 2)} />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{isPublic ? "Public" : "Private"} project</p>
              <p className="text-xs text-muted-foreground">
                {isPublic ? "Anyone can discover and apply" : "Only members can view"}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()} className="w-full">
            {submitting ? "Creating…" : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
