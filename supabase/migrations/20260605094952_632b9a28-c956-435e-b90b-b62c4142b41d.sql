
-- Event URL link
ALTER TABLE public.campus_events
  ADD COLUMN IF NOT EXISTS event_url text
  CHECK (event_url IS NULL OR char_length(event_url) <= 500);

-- Event announcements
CREATE TABLE IF NOT EXISTS public.event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.campus_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_announcements TO authenticated;
GRANT ALL ON public.event_announcements TO service_role;

ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view event announcements"
  ON public.event_announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Event creator can post announcements"
  ON public.event_announcements FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.campus_events e WHERE e.id = event_id AND e.creator_id = auth.uid())
  );

CREATE POLICY "Event creator can update their announcements"
  ON public.event_announcements FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Event creator can delete their announcements"
  ON public.event_announcements FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS event_announcements_event_idx
  ON public.event_announcements (event_id, created_at DESC);

CREATE TRIGGER event_announcements_set_updated_at
  BEFORE UPDATE ON public.event_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
