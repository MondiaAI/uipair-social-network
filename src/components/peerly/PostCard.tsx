import { useEffect, useMemo, useState } from "react";
import { Lightbulb, Flame, Brain, Bookmark, Check, MessageCircle, Share2, Radio, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { POST_TYPE_META, type PostType } from "@/lib/post-types";
import { useNavigate } from "@tanstack/react-router";
import { FeeBadge } from "@/components/peerly/ProjectCard";

export interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  post_type: PostType;
  university: string | null;
  is_live_session: boolean;
  created_at: string;
  profiles: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    university: string | null;
  } | null;
}

const REACTIONS = [
  { type: "lightbulb", icon: Lightbulb, label: "Insightful", color: "lightbulb" },
  { type: "fire", icon: Flame, label: "Hot take", color: "fire" },
  { type: "brain", icon: Brain, label: "Mind blown", color: "brain" },
  { type: "bookmark", icon: Bookmark, label: "Save", color: "bookmark" },
  { type: "agree", icon: Check, label: "I agree", color: "agree" },
] as const;

const MAX_LINES = 4;

export function PostCard({ post, onChange: _onChange }: { post: FeedPost; onChange: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; user_id: string; profiles: { username: string | null; avatar_url: string | null } | null }>>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [linkedProject, setLinkedProject] = useState<{
    id: string; name: string; is_public: boolean; join_fee_cents: number;
    fee_interval: "one_time" | "monthly"; member_count: number; team_size_limit: number; creator_id: string;
  } | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);

  const projectId = useMemo(() => {
    const m = post.content.match(/\/lab\/([0-9a-f-]{36})/i);
    return m?.[1] ?? null;
  }, [post.content]);

  useEffect(() => {
    loadReactions();
    loadCommentCount();
  }, [post.id]);

  useEffect(() => {
    if (!projectId) { setLinkedProject(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, is_public, join_fee_cents, fee_interval, member_count, team_size_limit, creator_id")
        .eq("id", projectId)
        .maybeSingle();
      if (!cancelled && data) setLinkedProject(data as typeof linkedProject);
      if (user && data) {
        const { data: m } = await supabase
          .from("project_members")
          .select("user_id")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setIsMember(!!m);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, user]);

  const handleJoinProject = async () => {
    if (!user || !linkedProject) return;
    setJoining(true);
    const { error } = await supabase.rpc("join_public_project", { _project_id: linkedProject.id });
    setJoining(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Joined ${linkedProject.name}!`);
    setIsMember(true);
    navigate({ to: "/lab/$projectId", params: { projectId: linkedProject.id } });
  };

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
    const has = myReactions.has(type);
    // optimistic
    setMyReactions((prev) => {
      const next = new Set(prev);
      has ? next.delete(type) : next.add(type);
      return next;
    });
    setCounts((prev) => ({ ...prev, [type]: (prev[type] ?? 0) + (has ? -1 : 1) }));

    if (has) {
      await supabase.from("reactions").delete()
        .eq("post_id", post.id).eq("user_id", user.id).eq("reaction_type", type as never);
    } else {
      await supabase.from("reactions").insert({
        post_id: post.id, user_id: user.id, reaction_type: type as never,
      });
    }
  };

  const submitComment = async () => {
    if (!user || !commentText.trim()) return;
    const { error } = await supabase.from("comments").insert({
      post_id: post.id, user_id: user.id, content: commentText.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setCommentText("");
    loadComments();
    loadCommentCount();
  };

  const sharePost = async () => {
    const url = `${window.location.origin}/feed#post-${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const author = post.profiles;
  const initials = (author?.full_name || author?.username || "?")
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const meta = POST_TYPE_META[post.post_type] ?? POST_TYPE_META.brainstorm;
  const lines = post.content.split("\n").length;
  const isLong = lines > MAX_LINES || post.content.length > 320;

  return (
    <article
      id={`post-${post.id}`}
      className={cn(
        "rounded-2xl border border-t-[3px] bg-card p-4 shadow-sm space-y-3",
        meta.bar,
      )}
    >
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
            {author?.university && <><span className="truncate">{author.university}</span><span>·</span></>}
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.is_live_session && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
              <Radio className="h-3 w-3" /> LIVE
            </span>
          )}
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            meta.chipBg, meta.chipText,
          )}>
            {meta.emoji} {meta.label}
          </span>
        </div>
      </header>

      <div>
        <p
          className={cn("whitespace-pre-wrap text-[15px] leading-relaxed", !expanded && isLong && "line-clamp-4")}
        >
          {renderContentWithLinks(post.content, navigate)}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {linkedProject && linkedProject.is_public && (
        <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Rocket className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">{linkedProject.name}</span>
            </div>
            <FeeBadge cents={linkedProject.join_fee_cents} interval={linkedProject.fee_interval} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{linkedProject.member_count}/{linkedProject.team_size_limit} members</span>
            {isMember ? (
              <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/lab/$projectId", params: { projectId: linkedProject.id } })}>
                Open Project
              </Button>
            ) : linkedProject.member_count >= linkedProject.team_size_limit ? (
              <Button size="sm" disabled>Project Full</Button>
            ) : linkedProject.join_fee_cents > 0 ? (
              <Button size="sm" onClick={() => navigate({ to: "/lab/$projectId", params: { projectId: linkedProject.id } })}>
                Join · ${(linkedProject.join_fee_cents / 100).toFixed(2)}
                {linkedProject.fee_interval === "monthly" ? "/mo" : ""}
              </Button>
            ) : (
              <Button size="sm" onClick={handleJoinProject} disabled={joining || !user}>
                {joining ? "Joining…" : "Join Project"}
              </Button>
            )}
          </div>
        </div>
      )}

      <footer className="flex items-center gap-1 pt-2 border-t flex-wrap">
        {REACTIONS.map((r) => {
          const Icon = r.icon;
          const active = myReactions.has(r.type);
          const count = counts[r.type] ?? 0;
          return (
            <button
              key={r.type}
              onClick={() => toggleReaction(r.type)}
              title={r.label}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                active && `bg-[var(--reaction-${r.color}-soft)] text-[var(--reaction-${r.color})]`,
              )}
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
        <button
          onClick={sharePost}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium hover:bg-muted text-muted-foreground"
          title="Share"
        >
          <Share2 className="h-4 w-4" />
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
