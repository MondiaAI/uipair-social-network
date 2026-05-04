import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image as ImageIcon, Paperclip, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPOSER_TAGS, POST_TYPE_META, type PostType } from "@/lib/post-types";
import { toast } from "sonner";

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<PostType>("brainstorm");
  const [isLive, setIsLive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initials = (profile?.full_name || profile?.username || "?")
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const firstName = (profile?.full_name || profile?.username || "there").split(" ")[0];

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: content.trim(),
      post_type: postType,
      is_live_session: isLive,
      university: profile?.university ?? null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setContent("");
    setPostType("brainstorm");
    setIsLive(false);
    onPosted();
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3">
          <Textarea
            placeholder={`What's on your mind, ${firstName}?`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[64px] resize-none border-none p-0 shadow-none focus-visible:ring-0 text-base"
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

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <button type="button" className="rounded-md p-2 hover:bg-muted" title="Image">
                <ImageIcon className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-md p-2 hover:bg-muted" title="File">
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsLive((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium hover:bg-muted",
                  isLive && "bg-destructive/10 text-destructive hover:bg-destructive/15",
                )}
                title="Live Session"
              >
                <Radio className="h-4 w-4" />
                Live
              </button>
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !content.trim()}>
              {submitting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
