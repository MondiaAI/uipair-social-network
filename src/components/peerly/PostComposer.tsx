import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image as ImageIcon, Paperclip, Radio, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPOSER_TAGS, POST_TYPE_META, type PostType } from "@/lib/post-types";
import { DegreePicker } from "@/components/peerly/DegreePicker";
import { toast } from "sonner";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<PostType>("brainstorm");
  const [isLive, setIsLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [degree, setDegree] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [mediaIsImage, setMediaIsImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = (profile?.full_name || profile?.username || "?")
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const firstName = (profile?.full_name || profile?.username || "there").split(" ")[0];

  const uploadFile = async (file: File, kind: "image" | "file") => {
    if (!user) {
      toast.error("Sign in to attach files");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    if (kind === "image" && !file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("post-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("post-media").getPublicUrl(path);
    setMediaUrl(pub.publicUrl);
    setMediaName(file.name);
    setMediaIsImage(kind === "image" || file.type.startsWith("image/"));
    setUploading(false);
    toast.success("Attached");
  };

  const clearMedia = () => {
    setMediaUrl(null);
    setMediaName(null);
    setMediaIsImage(false);
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("Sign in to post"); return; }
    if (!content.trim() && !mediaUrl) return;
    setSubmitting(true);
    const finalContent = mediaUrl && !mediaIsImage
      ? `${content.trim()}${content.trim() ? "\n\n" : ""}📎 ${mediaName ?? "Attachment"}: ${mediaUrl}`
      : content.trim();
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: finalContent,
      post_type: postType,
      is_live_session: isLive,
      university: profile?.university ?? null,
      media_url: mediaIsImage ? mediaUrl : null,
      degree,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setContent("");
    setPostType("brainstorm");
    setIsLive(false);
    setDegree(null);
    clearMedia();
    onPosted();
  };

  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-4 shadow-sm">
      <div className="flex gap-2 sm:gap-3">
        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-3">
          <Textarea
            placeholder={`What's on your mind, ${firstName}?`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="min-h-[80px] w-full resize-none rounded-xl border bg-muted/40 px-3 py-2 text-base shadow-none focus-visible:ring-2 focus-visible:ring-ring"
          />


          <div className="flex flex-wrap gap-2">
            {COMPOSER_TAGS.map((t) => {
              const meta = POST_TYPE_META[t];
              const active = postType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPostType(t)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                    active
                      ? cn(meta.chipBg, meta.chipText, "ring-2 ring-offset-1", meta.ring)
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {meta.emoji} {meta.label}
                </button>
              );
            })}
          </div>

          <DegreePicker value={degree} onChange={setDegree} label="Qualification" />

          {mediaUrl && (
            <div className="relative inline-block max-w-full rounded-lg border bg-muted/40 p-2">
              {mediaIsImage ? (
                <img src={mediaUrl} alt="Attachment preview" className="max-h-60 rounded" />
              ) : (
                <div className="flex items-center gap-2 px-2 py-1 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate max-w-[200px]">{mediaName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={clearMedia}
                className="absolute -right-2 -top-2 rounded-full bg-background border p-1 shadow"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f, "file");
              e.target.value = "";
            }}
          />

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md p-2 hover:bg-muted disabled:opacity-50"
                title="Add image"
                aria-label="Add image"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md p-2 hover:bg-muted disabled:opacity-50"
                title="Attach file"
                aria-label="Attach file"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLive((v) => {
                    const next = !v;
                    if (next) toast.success("Live session ON — your post will be marked LIVE");
                    else toast("Live session OFF");
                    return next;
                  });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium hover:bg-muted transition-colors",
                  isLive && "bg-destructive/10 text-destructive hover:bg-destructive/15 ring-1 ring-destructive/40",
                )}
                title="Toggle live session"
                aria-pressed={isLive}
              >
                <Radio className={cn("h-4 w-4", isLive && "animate-pulse")} />
                {isLive ? "Live • ON" : "Live"}
              </button>
            </div>
            <Button onClick={handleSubmit} disabled={submitting || uploading || (!content.trim() && !mediaUrl)}>
              {submitting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
