import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const POST_TYPES = [
  { value: "brainstorm", label: "💡 Brainstorm" },
  { value: "research", label: "🔬 Research" },
  { value: "partner", label: "🤝 Find a partner" },
  { value: "question", label: "❓ Question" },
  { value: "resource", label: "📚 Resource" },
] as const;

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<typeof POST_TYPES[number]["value"]>("brainstorm");
  const [submitting, setSubmitting] = useState(false);

  const initials = (profile?.full_name || profile?.username || "?")
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: content.trim(),
      post_type: postType,
      university: profile?.university ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setContent("");
    setPostType("brainstorm");
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
            placeholder="Share an idea, ask a question, drop a resource…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[80px] resize-none border-none p-0 shadow-none focus-visible:ring-0 text-base"
          />
          <div className="flex items-center justify-between gap-2">
            <Select value={postType} onValueChange={(v) => setPostType(v as typeof postType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSubmit} disabled={submitting || !content.trim()}>
              {submitting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
