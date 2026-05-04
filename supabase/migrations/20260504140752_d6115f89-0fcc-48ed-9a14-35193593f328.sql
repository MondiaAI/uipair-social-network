-- Track Stripe subscriptions for premium circles
CREATE TABLE public.circle_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  circle_id uuid NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  status text NOT NULL DEFAULT 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_circle_subs_user ON public.circle_subscriptions(user_id);
CREATE INDEX idx_circle_subs_circle ON public.circle_subscriptions(circle_id);
CREATE INDEX idx_circle_subs_user_circle_env ON public.circle_subscriptions(user_id, circle_id, environment);

ALTER TABLE public.circle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own circle subscriptions"
  ON public.circle_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No client-side INSERT/UPDATE/DELETE: webhook uses service role.

CREATE TRIGGER circle_subscriptions_set_updated_at
BEFORE UPDATE ON public.circle_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: does this user currently have access to the circle via subscription?
CREATE OR REPLACE FUNCTION public.has_active_circle_subscription(
  _user_id uuid,
  _circle_id uuid,
  _environment text DEFAULT 'sandbox'
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_subscriptions
    WHERE user_id = _user_id
      AND circle_id = _circle_id
      AND environment = _environment
      AND (
        (status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;