ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS custom_category text,
  ADD COLUMN IF NOT EXISTS custom_roles text;