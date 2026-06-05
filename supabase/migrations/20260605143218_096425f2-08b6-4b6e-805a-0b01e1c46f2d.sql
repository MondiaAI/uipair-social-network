
-- 1) Extend job_postings
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'employment'
    CHECK (category IN ('internship','employment')),
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS benefits text,
  ADD COLUMN IF NOT EXISTS company_logo_url text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS experience_level text
    CHECK (experience_level IS NULL OR experience_level IN ('entry','mid','senior','lead')),
  ADD COLUMN IF NOT EXISTS salary_min integer CHECK (salary_min IS NULL OR salary_min >= 0),
  ADD COLUMN IF NOT EXISTS salary_max integer CHECK (salary_max IS NULL OR salary_max >= 0),
  ADD COLUMN IF NOT EXISTS salary_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS salary_period text
    CHECK (salary_period IS NULL OR salary_period IN ('hour','month','year')),
  ADD COLUMN IF NOT EXISTS duration_months integer CHECK (duration_months IS NULL OR (duration_months > 0 AND duration_months <= 36)),
  ADD COLUMN IF NOT EXISTS stipend_amount integer CHECK (stipend_amount IS NULL OR stipend_amount >= 0);

-- Backfill category from job_type
UPDATE public.job_postings SET category = 'internship' WHERE job_type = 'internship' AND category <> 'internship';

CREATE INDEX IF NOT EXISTS job_postings_category_idx ON public.job_postings (category, is_active, created_at DESC);

-- 2) Extend job_applications
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS cover_letter text CHECK (cover_letter IS NULL OR length(cover_letter) <= 4000),
  ADD COLUMN IF NOT EXISTS resume_url text CHECK (resume_url IS NULL OR length(resume_url) <= 1000);

-- 3) payout_accounts
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('mobile_money','bank','flutterwave_wallet')),
  label text,
  is_default boolean NOT NULL DEFAULT false,
  -- Mobile money
  mm_country text,
  mm_provider text,
  mm_phone text,
  -- Bank
  bank_name text,
  bank_country text,
  bank_account_number text,
  bank_account_name text,
  bank_swift text,
  -- Flutterwave wallet
  wallet_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_accounts TO authenticated;
GRANT ALL ON public.payout_accounts TO service_role;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their payout accounts" ON public.payout_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners insert their payout accounts" ON public.payout_accounts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update their payout accounts" ON public.payout_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete their payout accounts" ON public.payout_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS payout_accounts_user_idx ON public.payout_accounts (user_id, created_at DESC);

CREATE TRIGGER trg_payout_accounts_updated_at
  BEFORE UPDATE ON public.payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) flutterwave_subscriptions
CREATE TABLE IF NOT EXISTS public.flutterwave_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly','yearly')),
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete','active','cancelled','expired','past_due')),
  currency text NOT NULL DEFAULT 'USD',
  amount_cents integer NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  flw_tx_ref text,
  flw_transaction_id text,
  flw_customer_email text,
  last_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.flutterwave_subscriptions TO authenticated;
GRANT ALL ON public.flutterwave_subscriptions TO service_role;
ALTER TABLE public.flutterwave_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own subscription" ON public.flutterwave_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS flw_subs_status_idx ON public.flutterwave_subscriptions (status, current_period_end);

CREATE TRIGGER trg_flw_subs_updated_at
  BEFORE UPDATE ON public.flutterwave_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to sync profiles.is_pro from active subscription
CREATE OR REPLACE FUNCTION public.tg_sync_is_pro_from_flw()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := COALESCE(NEW.user_id, OLD.user_id);
  is_active boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.flutterwave_subscriptions
    WHERE user_id = uid
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
  ) INTO is_active;
  UPDATE public.profiles SET is_pro = is_active WHERE id = uid;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_is_pro_from_flw ON public.flutterwave_subscriptions;
CREATE TRIGGER trg_sync_is_pro_from_flw
  AFTER INSERT OR UPDATE OR DELETE ON public.flutterwave_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_is_pro_from_flw();
