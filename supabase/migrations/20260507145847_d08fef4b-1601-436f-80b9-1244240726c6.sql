ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS degree text;
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS degree text;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS degree text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS degree text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS degree text;