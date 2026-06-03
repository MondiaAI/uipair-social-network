import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLocation } from "@/lib/normalize-location";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { PostComposer } from "@/components/peerly/PostComposer";
import { PostCard, type FeedPost } from "@/components/peerly/PostCard";
import { LiveSessionsRow } from "@/components/peerly/LiveSessionsRow";
import { FeedFilters, type FeedFilter } from "@/components/peerly/FeedFilters";
import { NewMembersRow } from "@/components/peerly/NewMembersRow";
import { onProfileUpdate } from "@/lib/profile-broadcast";
import { PostCardSkeleton } from "@/components/peerly/PostCardSkeleton";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/_app/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { profile } = useAuth();
  const { mode } = useFeedMode();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const hasLoadedRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPosts = useCallback(async () => {
    // Only show the skeleton on the very first load. Background refreshes
    // (filter changes, realtime updates) keep the existing posts visible
    // to avoid the blink/flash that comes from swapping in skeletons.
    if (!hasLoadedRef.current) setLoading(true);
    let q = supabase
      .from("posts")
      .select("id, user_id, content, post_type, university, is_live_session, media_url, created_at, profiles!posts_user_id_fkey(full_name, username, avatar_url, university)")
      .order("created_at", { ascending: false })
      .limit(50);

    const myUni = normalizeLocation(profile?.university);
    if (mode === "campus" && myUni) {
      q = q.eq("university", myUni);
    }
    if (filter !== "all") {
      q = q.eq("post_type", filter);
    }

    const { data, error } = await q;
    if (!error && data) setPosts(data as unknown as FeedPost[]);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [mode, profile?.university, filter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Realtime: refresh feed when posts change. Coalesce bursts of events
  // into a single refetch so the UI doesn't thrash, and don't listen to
  // every profile UPDATE on the platform — that fires constantly and
  // caused the feed to blink.
  useEffect(() => {
    const scheduleRefetch = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => loadPosts(), 400);
    };
    const channel = supabase
      .channel(uniqueRealtimeChannelName("feed-live"))
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleRefetch)
      .subscribe();
    const off = onProfileUpdate(scheduleRefetch);
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      supabase.removeChannel(channel);
      off();
    };
  }, [loadPosts]);

  return (
    <div data-scroll-container="feed" className="mx-auto w-full max-w-2xl px-3 sm:px-4 py-3 sm:py-6 space-y-3 sm:space-y-4 overflow-x-hidden">
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
        <div className="space-y-3 sm:space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton withImage />
          <PostCardSkeleton />
        </div>
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
