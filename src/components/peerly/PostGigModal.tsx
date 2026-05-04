import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GIG_CATEGORIES, CATEGORY_LABEL, type GigCategory } from "@/lib/gig-meta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function PostGigModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GigCategory>("tutoring");
  const [description, setDescription] = useState("");
  const [includedRaw, setIncludedRaw] = useState("");
  const [price, setPrice] = useState(20);
  const [days, setDays] = useState(3);
  const [requiresFile, setRequiresFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user || !title.trim()) return;
    setSubmitting(true);
    const items = includedRaw.split("\n").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("gigs").insert({
      seller_id: user.id,
      title: title.trim(),
      category,
      description: description.trim() || null,
      included_items: items,
      price_cents: Math.round(price * 100),
      delivery_days: days,
      requires_file_upload: requiresFile,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Gig posted!");
    setTitle(""); setDescription(""); setIncludedRaw(""); setPrice(20); setDays(3); setRequiresFile(false);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Post a Gig</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="I will tutor you in calculus 1" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as GigCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GIG_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={600} />
          </div>
          <div>
            <Label>What's included (one per line)</Label>
            <Textarea value={includedRaw} onChange={(e) => setIncludedRaw(e.target.value)} rows={3} placeholder="1-on-1 video session&#10;Custom practice problems" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price ($)</Label>
              <Input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Delivery (days)</Label>
              <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Requires file upload</p>
              <p className="text-xs text-muted-foreground">Buyer must send a file with their order</p>
            </div>
            <Switch checked={requiresFile} onCheckedChange={setRequiresFile} />
          </div>
          <Button onClick={submit} disabled={submitting || !title.trim()} className="w-full">
            {submitting ? "Posting…" : "Post Gig"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
