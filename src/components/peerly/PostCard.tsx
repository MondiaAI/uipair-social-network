import { useEffect, useState } from "react";
import { Lightbulb, Flame, Brain, Bookmark, ThumbsUp, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  post_type: string;
  university: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    university: string | null;
  } | null;
}

const REACTIONS = [
  { type: "lightbulb", icon: Lightbulb, label: "Insightful" },
  { type: "fire", icon: Flame, label: "Fire" },
  { type: "brain", icon: Brain, label: "Smart" },
  { type: "agree", icon: ThumbsUp, label: "Agree" },
  { type: "bookmark", icon: Bookmark, label: "Save" },
] as const;

const POST_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  brainstorm: { label: "💡 Brainstorm", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  research: { label: "🔬 Research", className: "bg-purple-100 text-purple-800 border-purple-200" },
  partner: { label: "🤝 Partner", className: "bg-blue-100 text-blue-800 border-blue-200" },
  question: { label: "❓ Question", className: "bg-pink-100 text-pink-800 border-pink-200" },
  resource: { label: "📚 Resource", className: "bg-green-100 text-green-800 border-green-200" },
};

export function PostCard({ post, onChange }: { post: FeedPost; onChange: () => void }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; user_id: string; profiles: { username: string | null; avatar_url: string | null } | null }>>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    loadReactions();
    loadCommentCount();
  }, [post.id]);

  const loadReactions = async () => {
    const { data } = await supabase
      .from("reactions")
      .select("reaction_type, user_id")
      .eq("post_id", post.id);
    const c: Record<string, number> = {};
    const mine = new Set<string>();
    for (const r of data ?? []) {
      c[r.reaction_type] = (c[r.reaction_type] ?? 0) + 1;
      if (r.user_id === user?.id) mine.add(r.reaction_type);
    }
    setCounts(c);
    setMyReactions(mine);
  };

  const loadCommentCount = async () => {
    const { count } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);
    setCommentCount(count ?? 0);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, profiles!comments_user_id_fkey(username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data ?? []) as typeof comments);
  };

  const toggleReaction = async (type: string) => {
    if (!user) return;
    if (myReactions.has(type)) {
      await supabase
        .from("reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id)
        .eq("reaction_type", type as never);
    } else {
      await supabase.from("reactions").insert({
        post_id: post.id,
        user_id: user.id,
        reaction_type: type as never,
      });
    }
    loadReactions();
  };

  const submitComment = async () => {
    if (!user || !commentText.trim()) return;
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: commentText.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setCommentText("");
    loadComments();
    loadCommentCount();
  };

  const author = post.profiles;
  const initials = (author?.full_name || author?.username || "?")
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const typeMeta = POST_TYPE_LABELS[post.post_type] ?? POST_TYPE_LABELS.brainstorm;

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
      <header className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{author?.full_name || "Student"}</span>
            <span className="text-xs text-muted-foreground">@{author?.username}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {author?.university && <span>{author.university}</span>}
            {author?.university && <span>·</span>}
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn("text-xs", typeMeta.className)}>
          {typeMeta.label}
        </Badge>
      </header>

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>

      <footer className="flex items-center gap-1 pt-1 border-t">
        {REACTIONS.map((r) => {
          const Icon = r.icon;
          const active = myReactions.has(r.type);
          const count = counts[r.type] ?? 0;
          return (
            <button
              key={r.type}
              onClick={() => toggleReaction(r.type)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                active && "bg-accent text-primary",
              )}
              title={r.label}
            >
              <Icon className={cn("h-4 w-4", active && "fill-current")} />
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
        <button
          onClick={() => {
            const next = !showComments;
            setShowComments(next);
            if (next) loadComments();
          }}
          className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium hover:bg-muted text-muted-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </footer>

      {showComments && (
        <div className="space-y-3 pt-2 border-t">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {(c.profiles?.username || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-lg bg-muted px-3 py-2">
                <div className="text-xs font-semibold">@{c.profiles?.username}</div>
                <div className="text-sm">{c.content}</div>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="min-h-[44px] resize-none"
            />
            <Button size="sm" onClick={submitComment} disabled={!commentText.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
