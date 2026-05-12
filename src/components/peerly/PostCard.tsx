import React, { useEffect, useMemo, useState } from "react";
import { Lightbulb, Flame, Brain, Bookmark, Check, MessageCircle, Share2, Radio, Pencil, Trash2, X } from "lucide-react";
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
import { ProjectFeedCard } from "@/components/peerly/ProjectFeedCard";

export interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  post_type: PostType;
  university: string | null;
  is_live_session: boolean;
  media_url?: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    university: string | null;
  } | null;
}

const REACTIONS = [
  { type: "lightbulb", icon: Lightbulb, emoji: "💡", label: "Insightful", tip: "Insightful — this taught me something", color: "lightbulb" },
  { type: "fire", icon: Flame, emoji: "🔥", label: "Hot Take", tip: "Hot Take — bold idea, I love it", color: "fire" },
  { type: "brain", icon: Brain, emoji: "🧠", label: "Mind Blown", tip: "Mind Blown — this changed how I think", color: "brain" },
  { type: "bookmark", icon: Bookmark, emoji: "🔖", label: "Save", tip: "Save — I need to come back to this", color: "bookmark" },
  { type: "agree", icon: Check, emoji: "✅", label: "I Agree", tip: "I Agree — I stand with this", color: "agree" },
] as const;

const MAX_LINES = 4;

const LINK_REGEX = /(\/lab\/[0-9a-f-]{36}|https?:\/\/[^\s)]+)/gi;

function renderContentWithLinks(text: string, navigate: ReturnType<typeof useNavigate>): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_REGEX);
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const url = match[0];
    if (url.startsWith("/lab/")) {
      const projectId = url.slice("/lab/".length);
      parts.push(
        <button
          key={`lnk-${i++}`}
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate({ to: "/lab/$projectId", params: { projectId } }); }}
          className="text-primary font-medium hover:underline"
        >
          {url}
        </button>
      );
    } else {
      parts.push(
        <a
          key={`lnk-${i++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary font-medium hover:underline break-all"
        >
          {url}
        </a>
      );
    }
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

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
    view_count: number;
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
        .select("id, name, is_public, join_fee_cents, fee_interval, member_count, team_size_limit, creator_id, view_count")
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
        "rounded-2xl border border-t-[3px] bg-card p-3 sm:p-4 shadow-sm space-y-2.5 sm:space-y-3",
        meta.bar,
      )}
    >
      <header className="flex items-start gap-2.5 sm:gap-3">
        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="font-semibold text-sm sm:text-[15px] truncate">{author?.full_name || "Student"}</span>
            <span className="text-[11px] sm:text-xs text-muted-foreground truncate">@{author?.username}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground min-w-0">
            {author?.university && <><span className="truncate">{author.university}</span><span className="shrink-0">·</span></>}
            <span className="shrink-0">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {post.is_live_session && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
              <Radio className="h-3 w-3" /> LIVE
            </span>
          )}
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap",
            meta.chipBg, meta.chipText,
          )}>
            <span aria-hidden>{meta.emoji}</span>
            <span className="hidden xs:inline sm:inline">{meta.label}</span>
          </span>
        </div>
      </header>

      <div>
        <p
          className={cn("whitespace-pre-wrap text-sm sm:text-[15px] leading-relaxed break-words", !expanded && isLong && "line-clamp-4")}
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

      {post.media_url && (
        <a href={post.media_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <img
            src={post.media_url}
            alt="Post attachment"
            loading="lazy"
            className="max-h-96 w-full rounded-lg border object-cover"
          />
        </a>
      )}

      {linkedProject && (
        <ProjectFeedCard
          project={linkedProject}
          isMember={isMember}
          onJoined={() => {
            setIsMember(true);
            setLinkedProject({ ...linkedProject, member_count: linkedProject.member_count + 1 });
          }}
        />
      )}

      <footer className="flex items-center gap-1 pt-2 border-t flex-wrap">
        {REACTIONS.map((r) => {
          const active = myReactions.has(r.type);
          const count = counts[r.type] ?? 0;
          return (
            <button
              key={r.type}
              onClick={() => toggleReaction(r.type)}
              title={r.tip}
              aria-label={r.label}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                active && `bg-[var(--reaction-${r.color}-soft)] text-[var(--reaction-${r.color})] ring-1 ring-[var(--reaction-${r.color})]/30`,
              )}
            >
              <span aria-hidden className="text-base leading-none">{r.emoji}</span>
              {count > 0 && <span className="text-xs">{count}</span>}
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
            <CommentRow
              key={c.id}
              comment={c}
              isOwner={c.user_id === user?.id}
              onUpdated={(content) => setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, content } : x))}
              onDeleted={() => {
                setComments((prev) => prev.filter((x) => x.id !== c.id));
                setCommentCount((n) => Math.max(0, n - 1));
              }}
            />
          ))}
          <div className="flex gap-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (commentText.trim()) submitComment();
                }
              }}
              placeholder="Write a comment… (Enter to send, Shift+Enter for new line)"
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

interface CommentRowProps {
  comment: { id: string; content: string; created_at: string; user_id: string; profiles: { username: string | null; avatar_url: string | null } | null };
  isOwner: boolean;
  onUpdated: (content: string) => void;
  onDeleted: () => void;
}

function CommentRow({ comment, isOwner, onUpdated, onDeleted }: CommentRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = draft.trim();
    if (!next || next === comment.content) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase.from("comments").update({ content: next }).eq("id", comment.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onUpdated(next);
    setEditing(false);
  };

  const remove = async () => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", comment.id);
    if (error) { toast.error(error.message); return; }
    onDeleted();
  };

  return (
    <div className="flex gap-2 group">
      <Avatar className="h-7 w-7">
        <AvatarImage src={comment.profiles?.avatar_url ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {(comment.profiles?.username || "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 rounded-lg bg-muted px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold">@{comment.profiles?.username}</div>
          {isOwner && !editing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setDraft(comment.content); setEditing(true); }} title="Edit" className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={remove} title="Delete" className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
                if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
              }}
              autoFocus
              className="min-h-[60px] text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving || !draft.trim()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">{comment.content}</div>
        )}
      </div>
    </div>
  );
}
