
-- 1. study_sessions for Deep Work timer + leaderboards
CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  subject text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view sessions for leaderboards"
  ON public.study_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert their own sessions"
  ON public.study_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own sessions"
  ON public.study_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own sessions"
  ON public.study_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER stamp_tenant_study_sessions BEFORE INSERT ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_user();
CREATE TRIGGER touch_study_sessions BEFORE UPDATE ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX study_sessions_user_idx ON public.study_sessions(user_id);
CREATE INDEX study_sessions_tenant_started_idx ON public.study_sessions(tenant_id, started_at DESC);

-- 2. referrals tracking
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());
CREATE POLICY "Insert self as referred"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (referred_user_id = auth.uid());
CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_user_id);
CREATE INDEX referrals_code_idx ON public.referrals(referral_code);

-- 3. Ambassador rewards
ALTER TABLE public.ambassador_applications
  ADD COLUMN IF NOT EXISTS premium_circle_credits_months integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_apply_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user uuid;
  new_count integer;
BEGIN
  UPDATE public.ambassador_applications
    SET referrals_count = referrals_count + 1,
        premium_circle_credits_months = ((referrals_count + 1) / 3)
    WHERE referral_code = NEW.referral_code
    RETURNING user_id, referrals_count INTO app_user, new_count;
  IF app_user IS NOT NULL AND new_count > 0 AND new_count % 3 = 0 THEN
    INSERT INTO public.notifications (user_id, type, content)
    VALUES (app_user, 'ambassador_reward',
      'You invited 3 friends! 1 month of Premium Circle access unlocked free.');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_referral_insert
  AFTER INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_referral();

-- 4. Verification badge
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id_url text;

CREATE OR REPLACE FUNCTION public.auto_verify_student(_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _url IS NULL OR length(_url) < 8 THEN
    RAISE EXCEPTION 'Invalid student ID upload' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.profiles
    SET student_id_url = _url,
        is_verified = true
    WHERE id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.auto_verify_student(text) TO authenticated;

-- 5. Storage policies for student-verifications bucket (private, per-user folder)
CREATE POLICY "verifications: users read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "verifications: users upload own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "verifications: users update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'student-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "verifications: users delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'student-verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
