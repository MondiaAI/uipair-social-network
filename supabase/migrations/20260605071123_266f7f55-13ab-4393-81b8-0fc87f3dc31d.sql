
CREATE TABLE public.campus_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  university TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description TEXT CHECK (char_length(description) <= 2000),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('party','academic','sports','club','career','cultural','volunteer','other')),
  location TEXT CHECK (char_length(location) <= 200),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  cover_url TEXT,
  rsvp_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campus_events TO authenticated;
GRANT ALL ON public.campus_events TO service_role;

ALTER TABLE public.campus_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view campus events"
  ON public.campus_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create their own campus events"
  ON public.campus_events FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update their own events"
  ON public.campus_events FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can delete their own events"
  ON public.campus_events FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

CREATE TRIGGER campus_events_set_updated_at
  BEFORE UPDATE ON public.campus_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_campus_events_university_starts ON public.campus_events(university, starts_at DESC);

-- RSVPs
CREATE TABLE public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.campus_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going','interested')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rsvps"
  ON public.event_rsvps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage their own rsvps insert"
  ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update their own rsvps"
  ON public.event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own rsvps"
  ON public.event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Maintain rsvp_count
CREATE OR REPLACE FUNCTION public.sync_event_rsvp_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.campus_events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.campus_events SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER event_rsvps_count
  AFTER INSERT OR DELETE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_rsvp_count();
