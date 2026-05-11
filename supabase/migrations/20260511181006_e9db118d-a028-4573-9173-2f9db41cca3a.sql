-- Ensure full row payloads on realtime events
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.follows REPLICA IDENTITY FULL;
ALTER TABLE public.circles REPLICA IDENTITY FULL;
ALTER TABLE public.circle_posts REPLICA IDENTITY FULL;
ALTER TABLE public.circle_post_comments REPLICA IDENTITY FULL;
ALTER TABLE public.circle_resources REPLICA IDENTITY FULL;
ALTER TABLE public.circle_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.project_members REPLICA IDENTITY FULL;
ALTER TABLE public.project_join_requests REPLICA IDENTITY FULL;
ALTER TABLE public.project_applications REPLICA IDENTITY FULL;
ALTER TABLE public.project_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.project_activity REPLICA IDENTITY FULL;
ALTER TABLE public.gigs REPLICA IDENTITY FULL;
ALTER TABLE public.gig_orders REPLICA IDENTITY FULL;
ALTER TABLE public.gig_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.bounties REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (idempotent)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'posts','comments','profiles','follows',
    'circles','circle_posts','circle_post_comments','circle_resources','circle_sessions',
    'project_members','project_join_requests','project_applications','project_tasks','project_activity',
    'gigs','gig_orders','gig_reviews','bounties'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;