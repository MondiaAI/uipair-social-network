import { useEffect, useState } from "react";
import { Settings, Users, CreditCard, Trash2, Save, Loader2, Crown, Link as LinkIcon } from "lucide-react";
import { CircleInvitesManager } from "./CircleInvitesManager";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECTS } from "@/lib/subjects";
import { toast } from "sonner";
import { format } from "date-fns";

interface CircleEditable {
  id: string;
  name: string;
  subject: string;
  description: string | null;
  scope: "campus" | "global";
  is_premium: boolean;
  price_monthly: number | null;
  meeting_schedule: string | null;
  resources_folder_url: string | null;
  leader_id: string;
}

interface MemberLite {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
}

export function CircleCreatorPanel({
  circle,
  members,
  onUpdated,
  onMemberRemoved,
}: {
  circle: CircleEditable;
  members: MemberLite[];
  onUpdated: () => void;
  onMemberRemoved: (userId: string) => void;
}) {
  const [name, setName] = useState(circle.name);
  const [subject, setSubject] = useState(circle.subject);
  const [description, setDescription] = useState(circle.description ?? "");
  const [scope, setScope] = useState<"campus" | "global">(circle.scope);
  const [isPremium, setIsPremium] = useState(circle.is_premium);
  const [price, setPrice] = useState(String(circle.price_monthly ?? ""));
  const [meeting, setMeeting] = useState(circle.meeting_schedule ?? "");
  const [resourcesUrl, setResourcesUrl] = useState(circle.resources_folder_url ?? "");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSubs(true);
      const { data } = await supabase
        .from("circle_subscriptions")
        .select("id,user_id,status,cancel_at_period_end,current_period_start,current_period_end")
        .eq("circle_id", circle.id)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setSubs((data ?? []) as SubscriptionRow[]);
        setLoadingSubs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [circle.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("circles")
      .update({
        name: name.trim(),
        subject,
        description: description.trim() || null,
        scope,
        is_premium: isPremium,
        price_monthly: isPremium ? Number(price) || null : null,
        meeting_schedule: meeting.trim() || null,
        resources_folder_url: resourcesUrl.trim() || null,
      })
      .eq("id", circle.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Circle updated");
    onUpdated();
  };

  const removeMember = async (userId: string) => {
    if (userId === circle.leader_id) { toast.error("You can't remove yourself as leader"); return; }
    if (!confirm("Remove this member from the circle?")) return;
    setRemovingId(userId);
    const { error } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", circle.id)
      .eq("user_id", userId);
    setRemovingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    onMemberRemoved(userId);
  };

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const activeSubs = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status) && !s.cancel_at_period_end);
  const canceling = subs.filter((s) => s.cancel_at_period_end);
  const monthly = circle.is_premium && circle.price_monthly ? activeSubs.length * Number(circle.price_monthly) : 0;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Crown className="h-5 w-5 text-amber-500" />
        <h2 className="font-semibold">Creator panel</h2>
        <Badge variant="outline" className="text-[10px] uppercase">Leader only</Badge>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" /> Members</TabsTrigger>
          <TabsTrigger value="subs"><CreditCard className="h-4 w-4 mr-1" /> Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4 space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "campus" | "global")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="campus">Campus</SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Meeting schedule</Label><Input value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder="e.g. Tuesdays 7pm UTC" /></div>
          <div><Label>Resources folder URL</Label><Input value={resourcesUrl} onChange={(e) => setResourcesUrl(e.target.value)} placeholder="https://drive.google.com/…" /></div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="cursor-pointer">Premium circle</Label>
              <p className="text-xs text-muted-foreground">Charge a monthly subscription for access.</p>
            </div>
            <Switch checked={isPremium} onCheckedChange={setIsPremium} />
          </div>
          {isPremium && (
            <div>
              <Label>Price (USD/month)</Label>
              <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="9" />
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No members yet.</p>
          ) : members.map((m) => {
            const name = m.full_name || m.username || "Member";
            const init = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
            const isLeader = m.id === circle.leader_id;
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8"><AvatarImage src={m.avatar_url ?? undefined} /><AvatarFallback className="text-xs">{init}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">{name}{isLeader && <Crown className="h-3 w-3 text-amber-500" />}</p>
                    {m.username && <p className="text-xs text-muted-foreground truncate">@{m.username}</p>}
                  </div>
                </div>
                {!isLeader && (
                  <Button size="sm" variant="outline" onClick={() => removeMember(m.id)} disabled={removingId === m.id}>
                    {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="subs" className="mt-4 space-y-3">
          {circle.is_premium ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-xl font-semibold">{activeSubs.length}</p>
                </div>
                <div className="rounded-md border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">Canceling</p>
                  <p className="text-xl font-semibold">{canceling.length}</p>
                </div>
                <div className="rounded-md border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">MRR</p>
                  <p className="text-xl font-semibold">${monthly.toFixed(0)}</p>
                </div>
              </div>
              {loadingSubs ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
              ) : subs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No subscriptions yet.</p>
              ) : (
                <div className="space-y-2">
                  {subs.map((s) => {
                    const m = memberMap.get(s.user_id);
                    const name = m?.full_name || m?.username || "Member";
                    const init = name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7"><AvatarImage src={m?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{init}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.current_period_end ? `Renews ${format(new Date(s.current_period_end), "MMM d")}` : "—"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            s.cancel_at_period_end ? "text-amber-600 border-amber-500/30 bg-amber-500/5"
                            : s.status === "active" || s.status === "trialing" ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                            : "text-muted-foreground"
                          }
                        >
                          {s.cancel_at_period_end ? "Canceling" : s.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              This is a free circle — no subscriptions to display. Enable premium in Settings to start charging.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
