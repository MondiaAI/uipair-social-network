import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BadgeCheck, Upload, Loader2, ShieldCheck, IdCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/verify")({
  component: VerifyPage,
});

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function VerifyPage() {
  const { user, profile, refreshProfile } = useAuth() as any;
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const verified = !!profile?.is_verified;

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return toast.error("Use JPG, PNG, or WEBP");
    if (f.size > MAX_SIZE) return toast.error("Max file size is 5MB");
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user || !file) return;
    setBusy(true);
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${user.id}/student-id-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("student-verifications")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setBusy(false);
      return toast.error(`Upload failed: ${upErr.message}`);
    }
    const { error: rpcErr } = await supabase.rpc("auto_verify_student", { _url: path });
    setBusy(false);
    if (rpcErr) return toast.error(rpcErr.message);
    toast.success("You're verified!");
    if (typeof refreshProfile === "function") await refreshProfile();
    else window.location.reload();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-primary text-white mb-2">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">University Verification</h1>
        <p className="mt-1 text-muted-foreground">
          Upload a clear photo of your student ID to unlock the verified badge — boosts trust on
          your profile and Partner Match cards.
        </p>
      </div>

      {verified ? (
        <Card className="p-6 flex items-center gap-3">
          <BadgeCheck className="h-8 w-8 text-emerald-500" />
          <div>
            <p className="font-semibold">You're verified</p>
            <p className="text-sm text-muted-foreground">
              Your verified badge is visible across UiPair.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Tips for instant approval</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Full ID visible (name, university, photo)</li>
              <li>No glare, no blur, plain background</li>
              <li>JPG, PNG, or WEBP — max 5MB</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IdCard className="h-4 w-4 text-primary" /> Student identity card
            </Label>
            <label className="flex items-center gap-3 rounded-md border border-dashed p-3 cursor-pointer hover:bg-muted/40 transition">
              {preview ? (
                <img src={preview} alt="Preview" className="h-16 w-16 rounded object-cover" />
              ) : (
                <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file ? file.name : "Tap to upload"}</p>
                <p className="text-xs text-muted-foreground">Auto-approved on upload</p>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
            </label>
          </div>

          <Button onClick={submit} disabled={!file || busy} className="w-full">
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : "Submit for verification"}
          </Button>
        </Card>
      )}
    </div>
  );
}
