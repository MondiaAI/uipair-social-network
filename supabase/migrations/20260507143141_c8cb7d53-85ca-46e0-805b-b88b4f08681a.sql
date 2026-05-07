
-- Extend gig categories
ALTER TYPE public.gig_category ADD VALUE IF NOT EXISTS 'video_editing';
ALTER TYPE public.gig_category ADD VALUE IF NOT EXISTS 'data_analysis';
ALTER TYPE public.gig_category ADD VALUE IF NOT EXISTS 'presentations';
ALTER TYPE public.gig_category ADD VALUE IF NOT EXISTS 'language_practice';
ALTER TYPE public.gig_category ADD VALUE IF NOT EXISTS 'music';
ALTER TYPE public.gig_category ADD VALUE IF NOT EXISTS 'photography';
ALTER TYPE public.gig_category ADD VALUE IF NOT EXISTS 'marketing';

-- Extend project categories
ALTER TYPE public.project_category ADD VALUE IF NOT EXISTS 'open_source';
ALTER TYPE public.project_category ADD VALUE IF NOT EXISTS 'thesis';
ALTER TYPE public.project_category ADD VALUE IF NOT EXISTS 'competition';
ALTER TYPE public.project_category ADD VALUE IF NOT EXISTS 'club';
ALTER TYPE public.project_category ADD VALUE IF NOT EXISTS 'nonprofit';

-- Allow custom category text for gigs (mirrors projects.custom_category)
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS custom_category text;

-- Allow custom subject for bounties / circles when "Other" is chosen
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS custom_subject text;
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS custom_subject text;
