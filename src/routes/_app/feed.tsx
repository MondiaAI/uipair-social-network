import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { PostComposer } from "@/components/peerly/PostComposer";
import { PostCard, type FeedPost } from "@/components/peerly/PostCard";
import { LiveSessionsRow } from "@/components/peerly/LiveSessionsRow";
import { FeedFilters, type FeedFilter } from "@/components/peerly/FeedFilters";
import { NewMembersRow } from "@/components/peerly/NewMembersRow";
import { onProfileUpdate } from "@/lib/profile-broadcast";

export const Route = createFileRoute("/_app/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { profile } = useAuth();
  const { mode } = useFeedMode();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedFilter>("all");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("posts")
      .select("id, user_id, content, post_type, university, is_live_session, media_url, created_at, profiles!posts_user_id_fkey(full_name, username, avatar_url, university)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (mode === "campus" && profile?.university) {
      q = q.eq("university", profile.university);
    }
    if (filter !== "all") {
      q = q.eq("post_type", filter);
    }

    const { data, error } = await q;
    if (!error && data) setPosts(data as unknown as FeedPost[]);
    setLoading(false);
  }, [mode, profile?.university, filter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Realtime: refresh feed when any user posts/edits/deletes a post or
  // updates their profile (so usernames, avatars and university show fresh).
  useEffect(() => {
    const channel = supabase
      .channel("feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => loadPosts())
      .subscribe();
    const off = onProfileUpdate(() => loadPosts());
    return () => { supabase.removeChannel(channel); off(); };
  }, [loadPosts]);

  return (
    <div data-scroll-container="feed" className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Feed</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "campus"
            ? profile?.university
              ? `Showing posts from ${profile.university}`
              : "Add your university in settings to see campus posts"
            : "Posts from students worldwide"}
        </p>
      </div>

      <LiveSessionsRow />

      <NewMembersRow />

      <PostComposer onPosted={loadPosts} />

      <FeedFilters value={filter} onChange={setFilter} />

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading feed…</div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {mode === "campus"
              ? "No posts from your campus yet. Be the first!"
              : "No posts yet. Share something!"}
          </p>
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={loadPosts} />)
      )}
    </div>
  );
}
