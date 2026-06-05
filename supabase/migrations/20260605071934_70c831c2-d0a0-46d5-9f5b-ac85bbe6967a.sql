
ALTER TABLE public.campus_events ADD COLUMN IF NOT EXISTS agenda TEXT CHECK (char_length(agenda) <= 5000);

-- Change RSVP status values
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_status_check;
UPDATE public.event_rsvps SET status = 'yes' WHERE status = 'going';
UPDATE public.event_rsvps SET status = 'maybe' WHERE status = 'interested';
ALTER TABLE public.event_rsvps ALTER COLUMN status SET DEFAULT 'yes';
ALTER TABLE public.event_rsvps ADD CONSTRAINT event_rsvps_status_check CHECK (status IN ('yes','no','maybe'));

-- Update trigger: rsvp_count tracks only 'yes' responses
CREATE OR REPLACE FUNCTION public.sync_event_rsvp_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  evt UUID;
BEGIN
  evt := COALESCE(NEW.event_id, OLD.event_id);
  UPDATE public.campus_events
    SET rsvp_count = (
      SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = evt AND status = 'yes'
    )
    WHERE id = evt;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS event_rsvps_count ON public.event_rsvps;
CREATE TRIGGER event_rsvps_count
  AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_rsvp_count();

-- Recompute existing counts
UPDATE public.campus_events e SET rsvp_count = (
  SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'yes'
);
