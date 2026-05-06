ALTER TABLE public.circle_announcements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_announcements;