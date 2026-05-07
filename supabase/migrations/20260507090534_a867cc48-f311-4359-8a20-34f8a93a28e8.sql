ALTER TABLE public.projects
  ADD COLUMN join_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN fee_interval text NOT NULL DEFAULT 'one_time';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_fee_interval_check
  CHECK (fee_interval IN ('one_time', 'monthly'));