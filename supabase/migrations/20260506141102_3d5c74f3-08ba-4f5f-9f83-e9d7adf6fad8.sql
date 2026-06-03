-- =========================
-- crash_reports
-- =========================
CREATE TABLE IF NOT EXISTS public.crash_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  label TEXT NOT NULL,
  route TEXT,
  error_name TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crash_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous) can submit a report. We use 'public' role
-- so even unauthenticated SSR/client errors can be captured.
CREATE POLICY "Anyone can submit crash reports"
ON public.crash_reports
FOR INSERT
TO public
WITH CHECK (
  user_id IS NULL OR auth.uid() = user_id
);

-- Submitters can read their own reports back.
CREATE POLICY "Users view their own crash reports"
ON public.crash_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX crash_reports_created_at_idx ON public.crash_reports (created_at DESC);
CREATE INDEX crash_reports_user_id_idx ON public.crash_reports (user_id);

-- =========================
-- universities
-- =========================
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (slug, country)
);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Universities viewable by authenticated"
ON public.universities
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can add universities"
ON public.universities
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX universities_country_idx ON public.universities (country);
CREATE INDEX universities_name_idx ON public.universities (name);

-- Add FK column on profiles
ALTER TABLE public.profiles
  ADD COLUMN university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL;

CREATE INDEX profiles_university_id_idx ON public.profiles (university_id);

-- Backfill universities from existing profile text values
INSERT INTO public.universities (name, country, slug)
SELECT DISTINCT
  trim(p.university),
  COALESCE(NULLIF(trim(p.country), ''), 'Unknown'),
  lower(regexp_replace(trim(p.university), '[^a-zA-Z0-9]+', '-', 'g'))
FROM public.profiles p
WHERE p.university IS NOT NULL AND trim(p.university) <> ''
ON CONFLICT (slug, country) DO NOTHING;

-- Link profiles to the just-inserted universities
UPDATE public.profiles p
SET university_id = u.id
FROM public.universities u
WHERE u.slug = lower(regexp_replace(trim(p.university), '[^a-zA-Z0-9]+', '-', 'g'))
  AND u.country = COALESCE(NULLIF(trim(p.country), ''), 'Unknown')
  AND p.university IS NOT NULL
  AND trim(p.university) <> ''
  AND p.university_id IS NULL;