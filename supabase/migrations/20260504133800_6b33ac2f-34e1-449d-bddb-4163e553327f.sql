ALTER TABLE public.circle_members REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'circle_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;
  END IF;
END $$;