-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Replace job_postings INSERT policy: only admins may post
DROP POLICY IF EXISTS "Premium verified alumni can post jobs" ON public.job_postings;
DROP POLICY IF EXISTS "Only UiPair admins can post jobs" ON public.job_postings;
CREATE POLICY "Only UiPair admins can post jobs" ON public.job_postings
  FOR INSERT TO authenticated
  WITH CHECK (poster_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- Admins can update/delete any posting
DROP POLICY IF EXISTS "Admins can update any job" ON public.job_postings;
CREATE POLICY "Admins can update any job" ON public.job_postings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete any job" ON public.job_postings;
CREATE POLICY "Admins can delete any job" ON public.job_postings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Posting submissions (requests from users to UiPair admins)
CREATE TABLE IF NOT EXISTS public.posting_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('job','internship','employment','paid_ad')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  company text NOT NULL CHECK (length(btrim(company)) BETWEEN 1 AND 150),
  company_website text,
  company_logo_url text,
  description text NOT NULL CHECK (length(description) BETWEEN 10 AND 8000),
  requirements text,
  benefits text,
  location text,
  is_remote boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT true,
  compensation text,
  salary_min integer CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max integer CHECK (salary_max IS NULL OR salary_max >= 0),
  salary_currency text DEFAULT 'USD',
  salary_period text CHECK (salary_period IS NULL OR salary_period IN ('hour','month','year')),
  experience_level text CHECK (experience_level IS NULL OR experience_level IN ('entry','mid','senior','lead')),
  duration_months integer CHECK (duration_months IS NULL OR (duration_months > 0 AND duration_months <= 36)),
  stipend_amount integer CHECK (stipend_amount IS NULL OR stipend_amount >= 0),
  apply_url text,
  apply_email text,
  deadline date,
  tags text[] NOT NULL DEFAULT '{}',
  -- paid-ad specific
  ad_budget_cents integer CHECK (ad_budget_cents IS NULL OR ad_budget_cents >= 0),
  ad_duration_days integer CHECK (ad_duration_days IS NULL OR ad_duration_days > 0),
  contact_email text NOT NULL,
  contact_phone text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','published')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posting_submissions TO authenticated;
GRANT ALL ON public.posting_submissions TO service_role;
ALTER TABLE public.posting_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can submit" ON public.posting_submissions
  FOR INSERT TO authenticated WITH CHECK (submitter_id = auth.uid());

CREATE POLICY "Submitters can view their own submissions" ON public.posting_submissions
  FOR SELECT TO authenticated USING (submitter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Submitters can update pending submissions" ON public.posting_submissions
  FOR UPDATE TO authenticated
  USING (submitter_id = auth.uid() AND status = 'pending')
  WITH CHECK (submitter_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can update any submission" ON public.posting_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Submitters and admins can delete" ON public.posting_submissions
  FOR DELETE TO authenticated
  USING (submitter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS posting_submissions_status_idx ON public.posting_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS posting_submissions_submitter_idx ON public.posting_submissions(submitter_id, created_at DESC);

CREATE TRIGGER posting_submissions_set_updated_at
  BEFORE UPDATE ON public.posting_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();