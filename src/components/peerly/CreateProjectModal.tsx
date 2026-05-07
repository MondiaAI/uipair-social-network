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
  const [joinFee, setJoinFee] = useState(0);
  const [feeInterval, setFeeInterval] = useState<"one_time" | "monthly">("one_time");
  const [submitting, setSubmitting] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");
  const { people, loading: peopleLoading } = useNetworkPeople();

  const toggleRole = (r: ProjectRole) =>
    setOpenRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const toggleInvitee = (id: string) =>
    setInvitees((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const filteredPeople = people.filter((p) => {
    const q = peopleQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.full_name ?? "").toLowerCase().includes(q) ||
      (p.username ?? "").toLowerCase().includes(q) ||
      (p.university ?? "").toLowerCase().includes(q)
    );
  });

  const reset = () => {
    setName(""); setDescription(""); setCategory("other"); setOpenRoles([]);
    setTeamSize(5); setDeadline(""); setIsPublic(true); setJoinFee(0); setFeeInterval("one_time"); setInvitees([]); setPeopleQuery("");
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
        join_fee_cents: isPublic ? Math.max(0, Math.round(joinFee * 100)) : 0,
        fee_interval: isPublic ? feeInterval : "one_time",
      })
      .select("id")
      .single();
    if (error || !data) {
      setSubmitting(false);
      toast.error(error?.message ?? "Failed to create project");
      return;
    }
    if (invitees.length) {
      const rows = invitees.map((uid) => ({ project_id: data.id, user_id: uid, role: "other" as const }));
      const { error: memErr } = await supabase.from("project_members").insert(rows);
      if (memErr) {
        toast.error(`Project created, but couldn't add some teammates: ${memErr.message}`);
      } else {
        toast.success(`Project created with ${invitees.length} teammate${invitees.length === 1 ? "" : "s"}!`);
      }
    } else {
      toast.success("Project created!");
    }
    if (isPublic) {
      const roleStr = openRoles.length ? ` Looking for: ${openRoles.join(", ")}.` : "";
      const feeStr =
        joinFee > 0
          ? `\n\n💰 Join fee: $${joinFee.toFixed(2)}${feeInterval === "monthly" ? "/month" : " (one-time)"}`
          : `\n\n✅ Free to join`;
      const announcement = `🚀 New project in the Lab: ${name.trim()}${description.trim() ? `\n\n${description.trim()}` : ""}${roleStr}${feeStr}\n\n👉 Join here: /lab/${data.id}`;
      await supabase.from("posts").insert({
        user_id: user.id,
        content: announcement,
        post_type: "partner",
      });
    }
    setSubmitting(false);
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
          {isPublic && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Join fee (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={joinFee}
                  onChange={(e) => setJoinFee(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0 = free"
                />
              </div>
              <div>
                <Label>Fee type</Label>
                <Select value={feeInterval} onValueChange={(v) => setFeeInterval(v as "one_time" | "monthly")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Invite teammates</Label>
              {invitees.length > 0 && (
                <span className="text-xs text-muted-foreground">{invitees.length} selected</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Pick from people you follow, your friends, and your study circle members.
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
                placeholder="Search your network…"
                className="pl-8"
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {peopleLoading ? (
                <p className="p-3 text-xs text-muted-foreground">Loading your network…</p>
              ) : filteredPeople.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  {people.length === 0
                    ? "Follow peers, add friends, or join circles to invite teammates here."
                    : "No matches."}
                </p>
              ) : (
                filteredPeople.map((p) => {
                  const selected = invitees.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleInvitee(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-accent",
                        selected && "bg-accent",
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback>{(p.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.full_name ?? p.username ?? "Unnamed"}</p>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(p.sources).map((s) => (
                            <Badge key={s} variant="secondary" className="px-1.5 py-0 text-[10px] capitalize">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()} className="w-full">
            {submitting ? "Creating…" : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
