import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image as ImageIcon, Paperclip, Radio, X, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPOSER_TAGS, POST_TYPE_META, type PostType } from "@/lib/post-types";
import { DegreePicker } from "@/components/peerly/DegreePicker";
import { toast } from "sonner";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CONTENT_LEN = 2000;
const WARN_REMAINING = 200;
const DRAFT_KEY_PREFIX = "peerly:composer:draft:";

type Draft = {
  content: string;
  postType: PostType;
  isLive: boolean;
  degree: string | null;
};


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
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const savedScrollYRef = useRef<number | null>(null);
  const didScrollIntoViewRef = useRef(false);
  const draftKey = user ? `${DRAFT_KEY_PREFIX}${user.id}` : null;
  const draftLoadedRef = useRef(false);

  // ---- Draft autosave ----------------------------------------------------
  // Restore any saved draft for this user on mount / when the user resolves.
  useEffect(() => {
    if (!draftKey || draftLoadedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft>;
        if (typeof d.content === "string") setContent(d.content.slice(0, MAX_CONTENT_LEN));
        if (d.postType) setPostType(d.postType);
        if (typeof d.isLive === "boolean") setIsLive(d.isLive);
        if (typeof d.degree === "string" || d.degree === null) setDegree(d.degree ?? null);
      }
    } catch {
      /* ignore corrupt draft */
    }
    draftLoadedRef.current = true;
  }, [draftKey]);

  // Persist the draft as the user types / changes options.
  useEffect(() => {
    if (!draftKey || !draftLoadedRef.current) return;
    if (typeof window === "undefined") return;
    const handle = window.setTimeout(() => {
      try {
        if (!content.trim() && !degree && !isLive && postType === "brainstorm") {
          window.localStorage.removeItem(draftKey);
          return;
        }
        const draft: Draft = { content, postType, isLive, degree };
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        /* quota / private mode — silently ignore */
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [content, postType, isLive, degree, draftKey]);

  // ---- Keyboard / viewport tracking --------------------------------------
  // Track the iOS on-screen keyboard via visualViewport so the composer
  // stays visible while typing, without re-scrolling on every keystroke
  // (which previously caused the textarea to "jump" as the user typed).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKeyboardInset(0);
    };
  }, []);


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
    const loadingId = toast.loading("Posting…");
    const finalContent = mediaUrl && !mediaIsImage
      ? `${content.trim()}${content.trim() ? "\n\n" : ""}📎 ${mediaName ?? "Attachment"}: ${mediaUrl}`
      : content.trim();
    try {
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: finalContent,
        post_type: postType,
        is_live_session: isLive,
        university: profile?.university ?? null,
        media_url: mediaIsImage ? mediaUrl : null,
        degree,
      });
      if (error) throw error;
      toast.success("Posted", { id: loadingId });
      setContent("");
      setPostType("brainstorm");
      setIsLive(false);
      setDegree(null);
      clearMedia();
      if (draftKey && typeof window !== "undefined") {
        try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
      }
      onPosted();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't post. Please try again.", { id: loadingId });
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div
      ref={containerRef}
      className="rounded-2xl border bg-card p-3 sm:p-4 shadow-sm transition-[padding] duration-200"
      style={{
        paddingBottom:
          keyboardInset > 0
            ? `calc(${keyboardInset}px + 0.75rem)`
            : "max(0.75rem, env(safe-area-inset-bottom))",
        scrollMarginBottom: keyboardInset > 0 ? `${keyboardInset + 16}px` : undefined,
      }}
    >
      <div className="flex gap-2 sm:gap-3">
        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-3">
          <Textarea
            ref={textareaRef}
            placeholder={`What's on your mind, ${firstName}?`}
            value={content}
            onChange={(e) => {
              const next = e.target.value.slice(0, MAX_CONTENT_LEN);
              setContent(next);
            }}
            maxLength={MAX_CONTENT_LEN}
            rows={3}
            onFocus={(e) => {
              // Save the page scroll position so we can restore it after
              // the keyboard closes — prevents the layout from "jumping".
              if (typeof window !== "undefined" && savedScrollYRef.current === null) {
                savedScrollYRef.current = window.scrollY;
              }
              const el = e.currentTarget;
              // Only scroll the composer into view ONCE per focus session.
              // Re-scrolling on every visualViewport resize caused the
              // textarea to jump as the user typed.
              if (!didScrollIntoViewRef.current) {
                didScrollIntoViewRef.current = true;
                setTimeout(() => {
                  el?.scrollIntoView({ block: "center", behavior: "smooth" });
                }, 250);
              }
            }}
            onBlur={() => {
              // Restore layout + scroll position when the keyboard dismisses.
              setKeyboardInset(0);
              didScrollIntoViewRef.current = false;
              const y = savedScrollYRef.current;
              savedScrollYRef.current = null;
              if (typeof window !== "undefined" && y !== null) {
                // Defer so iOS finishes the viewport resize first.
                setTimeout(() => window.scrollTo({ top: y, behavior: "smooth" }), 50);
              }
            }}
            className="min-h-[96px] w-full resize-none rounded-xl border bg-muted/40 px-3 py-3 text-base leading-relaxed shadow-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {/* Live character count + remaining-limit indicator */}
          <div
            className={cn(
              "flex justify-end text-xs tabular-nums",
              content.length >= MAX_CONTENT_LEN
                ? "text-destructive font-semibold"
                : MAX_CONTENT_LEN - content.length <= WARN_REMAINING
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            <span>
              {content.length.toLocaleString()} / {MAX_CONTENT_LEN.toLocaleString()}
              {MAX_CONTENT_LEN - content.length <= WARN_REMAINING && (
                <span className="ml-1">
                  ({(MAX_CONTENT_LEN - content.length).toLocaleString()} left)
                </span>
              )}
            </span>
          </div>




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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading || submitting}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 disabled:opacity-50"
                title="Add image"
                aria-label="Add image"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || submitting}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 disabled:opacity-50"
                title="Attach file"
                aria-label="Attach file"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setIsLive((v) => {
                    const next = !v;
                    if (next) toast.success("Live session ON — your post will be marked LIVE");
                    else toast("Live session OFF");
                    return next;
                  });
                }}
                className={cn(
                  "inline-flex h-11 min-w-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-muted active:bg-muted/80 transition-colors disabled:opacity-50",
                  isLive && "bg-destructive/10 text-destructive hover:bg-destructive/15 ring-1 ring-destructive/40",
                )}
                title="Toggle live session"
                aria-pressed={isLive}
              >
                <Radio className={cn("h-5 w-5", isLive && "animate-pulse")} />
                <span className="hidden xs:inline sm:inline">{isLive ? "Live • ON" : "Live"}</span>
              </button>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || uploading || (!content.trim() && !mediaUrl)}
              className="ml-auto h-11 min-w-[96px] gap-2 px-5 text-sm font-semibold"
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Post
                </>
              )}
            </Button>
          </div>


        </div>
      </div>
    </div>
  );
}
