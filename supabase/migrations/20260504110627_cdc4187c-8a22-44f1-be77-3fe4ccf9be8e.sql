-- Circle scope enum
CREATE TYPE public.circle_scope AS ENUM ('campus', 'global');
CREATE TYPE public.circle_member_role AS ENUM ('leader', 'moderator', 'member');

-- Circles table
CREATE TABLE IF NOT EXISTS public.circles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  leader_id UUID NOT NULL,
  scope circle_scope NOT NULL DEFAULT 'global',
  university TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  price_monthly NUMERIC(10,2),
  meeting_schedule TEXT,
  resources_folder_url TEXT,
  cover_color TEXT,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_circles_subject ON public.circles(subject);
CREATE INDEX idx_circles_leader ON public.circles(leader_id);

ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circles viewable by authenticated"
  ON public.circles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create circles"
  ON public.circles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = leader_id);

CREATE POLICY "Leaders can update their circles"
  ON public.circles FOR UPDATE TO authenticated
  USING (auth.uid() = leader_id);

CREATE POLICY "Leaders can delete their circles"
  ON public.circles FOR DELETE TO authenticated
  USING (auth.uid() = leader_id);

CREATE TRIGGER trg_circles_updated_at
  BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Circle members
CREATE TABLE IF NOT EXISTS public.circle_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role circle_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);

CREATE INDEX idx_circle_members_user ON public.circle_members(user_id);
CREATE INDEX idx_circle_members_circle ON public.circle_members(circle_id);

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members viewable by authenticated"
  ON public.circle_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join circles themselves"
  ON public.circle_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave circles"
  ON public.circle_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Helper function to check membership without recursion
CREATE OR REPLACE FUNCTION public.is_circle_member(_circle_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = _circle_id AND user_id = _user_id
  );
$$;

-- Circle posts (discussion)
CREATE TABLE IF NOT EXISTS public.circle_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_circle_posts_circle ON public.circle_posts(circle_id, created_at DESC);

ALTER TABLE public.circle_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle posts viewable by authenticated"
  ON public.circle_posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can post in circles"
  ON public.circle_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_circle_member(circle_id, auth.uid()));

CREATE POLICY "Users can delete own circle posts"
  ON public.circle_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Circle resources
CREATE TABLE IF NOT EXISTS public.circle_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'link',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_circle_resources_circle ON public.circle_resources(circle_id, created_at DESC);

ALTER TABLE public.circle_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle resources viewable by authenticated"
  ON public.circle_resources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can upload resources"
  ON public.circle_resources FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_circle_member(circle_id, auth.uid()));

CREATE POLICY "Users can delete own resources"
  ON public.circle_resources FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Circle sessions (scheduled meetings)
CREATE TABLE IF NOT EXISTS public.circle_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  join_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_circle_sessions_circle ON public.circle_sessions(circle_id, scheduled_at);

ALTER TABLE public.circle_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle sessions viewable by authenticated"
  ON public.circle_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members can create sessions"
  ON public.circle_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_circle_member(circle_id, auth.uid()));

CREATE POLICY "Users can delete own sessions"
  ON public.circle_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create leader membership and keep member_count in sync
CREATE OR REPLACE FUNCTION public.handle_new_circle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (NEW.id, NEW.leader_id, 'leader')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_circles_after_insert
  AFTER INSERT ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_circle();

CREATE OR REPLACE FUNCTION public.sync_circle_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.circles SET member_count = member_count + 1 WHERE id = NEW.circle_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.circles SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.circle_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_circle_members_count_ins
  AFTER INSERT ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_circle_member_count();

CREATE TRIGGER trg_circle_members_count_del
  AFTER DELETE ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_circle_member_count();