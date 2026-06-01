-- Rename Stripe-specific columns to Flutterwave equivalents
ALTER TABLE public.circle_subscriptions
  RENAME COLUMN stripe_subscription_id TO fw_subscription_id;

ALTER TABLE public.circle_subscriptions
  RENAME COLUMN stripe_customer_id TO fw_customer_id;
