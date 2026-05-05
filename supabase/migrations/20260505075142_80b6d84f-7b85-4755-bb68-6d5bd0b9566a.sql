
-- Post type for circle posts
DO $$ BEGIN
  CREATE TYPE public.circle_post_kind AS ENUM ('discussion','research','partner','question','resource');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.circle_posts
  ADD COLUMN IF NOT EXISTS post_type public.circle_post_kind NOT NULL DEFAULT 'discussion';

-- Comments on circle posts
CREATE TABLE IF NOT EXISTS public.circle_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.circle_posts(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circle_post_comments_post ON public.circle_post_comments(post_id, created_at);

ALTER TABLE public.circle_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle post comments viewable by authenticated"
  ON public.circle_post_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can comment on circle posts"
  ON public.circle_post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_circle_member(circle_id, auth.uid()));

CREATE POLICY "Users delete own circle post comments"
  ON public.circle_post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
