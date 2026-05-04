-- Extend profiles with matching fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goals text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

-- Study request status enum
DO $$ BEGIN
  CREATE TYPE public.study_request_status AS ENUM ('pending','accepted','declined','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.study_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject text NOT NULL,
  message text,
  proposed_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status public.study_request_status NOT NULL DEFAULT 'pending',
  join_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_requests_recipient ON public.study_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_study_requests_sender ON public.study_requests(sender_id);

ALTER TABLE public.study_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view requests"
  ON public.study_requests FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send requests"
  ON public.study_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Participants can update requests"
  ON public.study_requests FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Participants can delete requests"
  ON public.study_requests FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE TRIGGER trg_study_requests_updated_at
  BEFORE UPDATE ON public.study_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();