-- Job postings table for premium internship/employment dashboard
CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  company text NOT NULL CHECK (length(btrim(company)) BETWEEN 1 AND 150),
  description text NOT NULL CHECK (length(description) BETWEEN 10 AND 8000),
  job_type text NOT NULL CHECK (job_type IN ('internship','full_time','part_time','contract','volunteer')),
  location text,
  is_remote boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT true,
  compensation text,
  apply_url text,
  apply_email text,
  deadline date,
  tags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_postings_active_created_idx ON public.job_postings (is_active, created_at DESC);
CREATE INDEX job_postings_poster_idx ON public.job_postings (poster_id);
CREATE INDEX job_postings_type_idx ON public.job_postings (job_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_postings TO authenticated;
GRANT ALL ON public.job_postings TO service_role;

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- View: only premium subscribers (is_pro=true) can browse the dashboard
CREATE POLICY "Premium users can view active jobs"
  ON public.job_postings FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_pro = true)
  );

CREATE POLICY "Posters can view their own jobs"
  ON public.job_postings FOR SELECT
  TO authenticated
  USING (poster_id = auth.uid());

-- Insert: premium AND verified alumni (is_verified + graduation_year in past)
CREATE POLICY "Premium verified alumni can post jobs"
  ON public.job_postings FOR INSERT
  TO authenticated
  WITH CHECK (
    poster_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_pro = true
        AND p.is_verified = true
        AND p.graduation_year IS NOT NULL
        AND p.graduation_year <= extract(year from now())::int
    )
  );

CREATE POLICY "Posters can update their own jobs"
  ON public.job_postings FOR UPDATE
  TO authenticated
  USING (poster_id = auth.uid())
  WITH CHECK (poster_id = auth.uid());

CREATE POLICY "Posters can delete their own jobs"
  ON public.job_postings FOR DELETE
  TO authenticated
  USING (poster_id = auth.uid());

CREATE TRIGGER job_postings_set_updated_at
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Applications / saved tracker
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','applied','interviewing','offer','rejected','withdrawn')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);

CREATE INDEX job_applications_user_idx ON public.job_applications (user_id, updated_at DESC);
CREATE INDEX job_applications_job_idx ON public.job_applications (job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own applications"
  ON public.job_applications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Job posters can view applications to their jobs"
  ON public.job_applications FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_postings j WHERE j.id = job_id AND j.poster_id = auth.uid()));

CREATE TRIGGER job_applications_set_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();