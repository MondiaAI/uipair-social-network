import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  BadgeCheck, Upload, Loader2, ShieldCheck, IdCard,
  AlertCircle, Clock, RefreshCw, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/verify")({
  component: VerifyPage,
});

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Status = "idle" | "pending" | "success" | "failed";

function VerifyPage() {
  const { user, profile, refreshProfile } = useAuth() as any;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(profile?.is_verified ? "success" : "idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const verified = !!profile?.is_verified || status === "success";

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return toast.error("Use JPG, PNG, or WEBP");
    if (f.size > MAX_SIZE) return toast.error("Max file size is 5MB");
    setFile(f);
    setErrorMsg(null);
    setStatus("idle");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (overrideFile?: File) => {
    const f = overrideFile ?? file;
    if (!user || !f) return;
    setStatus("pending");
    setErrorMsg(null);
    setProgress(10);
    const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${user.id}/student-id-${Date.now()}.${ext}`;

    // Fake progress until upload returns
    const ticker = setInterval(() => {
      setProgress((p) => (p < 80 ? p + 8 : p));
    }, 180);

    const { error: upErr } = await supabase.storage
      .from("student-verifications")
      .upload(path, f, { upsert: true, contentType: f.type });

    clearInterval(ticker);

    if (upErr) {
      setProgress(0);
      setStatus("failed");
      setErrorMsg(upErr.message || "Upload failed. Please try again.");
      return;
    }
    setProgress(90);
    const { error: rpcErr } = await supabase.rpc("auto_verify_student", { _url: path });
    if (rpcErr) {
      setStatus("failed");
      setErrorMsg(rpcErr.message || "Verification failed. Please try again.");
      setProgress(0);
      return;
    }
    setProgress(100);
    setStatus("success");
    toast.success("You're verified!");
    if (typeof refreshProfile === "function") await refreshProfile();
  };

  const retry = () => {
    if (file) submit(file);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-primary text-white mb-2">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">University Verification</h1>
        <p className="mt-1 text-muted-foreground">
          Upload a clear photo of your student ID to unlock the verified badge.
        </p>
      </div>

      {/* Status banner */}
      <StatusBanner status={status} errorMsg={errorMsg} verified={verified} />

      {verified ? (
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <BadgeCheck className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="font-semibold">You're verified</p>
              <p className="text-sm text-muted-foreground">
                Your verified badge is visible across UiPair.
              </p>
            </div>
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
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPick}
                disabled={status === "pending"}
              />
            </label>
          </div>

          {status === "pending" && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Uploading and verifying… {progress}%</p>
            </div>
          )}

          {status === "failed" ? (
            <div className="flex gap-2">
              <Button onClick={retry} disabled={!file} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" /> Retry verification
              </Button>
            </div>
          ) : (
            <Button onClick={() => submit()} disabled={!file || status === "pending"} className="w-full">
              {status === "pending" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</>
              ) : (
                "Submit for verification"
              )}
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}

function StatusBanner({
  status, errorMsg, verified,
}: { status: Status; errorMsg: string | null; verified: boolean }) {
  if (verified) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Verified</p>
          <p className="text-muted-foreground">Your verified badge is live across UiPair.</p>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-500 mt-0.5 animate-pulse" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Pending</p>
          <p className="text-muted-foreground">Uploading your student ID and running verification…</p>
        </div>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Verification failed</p>
          <p className="text-muted-foreground">
            {errorMsg ?? "Something went wrong. Check your image and try again."}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
