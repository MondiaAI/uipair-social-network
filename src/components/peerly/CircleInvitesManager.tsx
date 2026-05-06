import { useEffect, useState } from "react";
import { Copy, Link as LinkIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

interface Invite {
  id: string;
  token: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export function CircleInvitesManager({ circleId, userId }: { circleId: string; userId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [maxUses, setMaxUses] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("circle_invites")
      .select("id,token,max_uses,use_count,expires_at,is_active,created_at")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [circleId]);

  const inviteUrl = (token: string) =>
    `${window.location.origin}/invite/${token}`;

  const createInvite = async () => {
    setCreating(true);
    const expires_at = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
      : null;
    const { error } = await supabase.from("circle_invites").insert({
      circle_id: circleId,
      created_by: userId,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setMaxUses(""); setExpiresInDays("");
    toast.success("Invite link created");
    load();
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this invite link? It will stop working immediately.")) return;
    const { error } = await supabase.from("circle_invites").update({ is_active: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite revoked");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Generate invite link</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Max uses (optional)</Label>
            <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="∞" />
          </div>
          <div>
            <Label className="text-xs">Expires in days (optional)</Label>
            <Input type="number" min="1" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder="Never" />
          </div>
        </div>
        <Button size="sm" onClick={createInvite} disabled={creating} className="w-full">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create invite link
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
      ) : invites.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No invite links yet.</p>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => {
            const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
            const exhausted = inv.max_uses != null && inv.use_count >= inv.max_uses;
            const dead = !inv.is_active || expired || exhausted;
            return (
              <div key={inv.id} className="rounded-md border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input readOnly value={inviteUrl(inv.token)} className="text-xs h-8 font-mono" />
                  <Button size="sm" variant="outline" onClick={() => copy(inv.token)} disabled={dead}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {inv.is_active && (
                    <Button size="sm" variant="outline" onClick={() => revoke(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className={dead ? "text-muted-foreground" : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"}>
                    {!inv.is_active ? "Revoked" : expired ? "Expired" : exhausted ? "Used up" : "Active"}
                  </Badge>
                  <span>{inv.use_count}{inv.max_uses ? ` / ${inv.max_uses}` : ""} uses</span>
                  {inv.expires_at && <span>· Expires {format(new Date(inv.expires_at), "MMM d, yyyy")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
