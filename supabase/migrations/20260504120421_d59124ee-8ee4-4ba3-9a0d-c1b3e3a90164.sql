
-- Enums
CREATE TYPE public.project_category AS ENUM ('hackathon', 'research', 'startup', 'course', 'other');
CREATE TYPE public.project_role AS ENUM ('creator', 'designer', 'coder', 'researcher', 'writer', 'other');
CREATE TYPE public.project_application_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE public.project_task_status AS ENUM ('todo', 'in_progress', 'done');

-- Projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  category public.project_category NOT NULL DEFAULT 'other',
  open_roles public.project_role[] NOT NULL DEFAULT '{}',
  team_size_limit INTEGER NOT NULL DEFAULT 5,
  deadline TIMESTAMPTZ,
  is_public BOOLEAN NOT NULL DEFAULT true,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  cover_color TEXT,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.project_role NOT NULL DEFAULT 'other',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE public.project_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  desired_role public.project_role NOT NULL DEFAULT 'other',
  message TEXT,
  status public.project_application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, applicant_id)
);

CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assignee_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  status public.project_task_status NOT NULL DEFAULT 'todo',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'link',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hackathon_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_logo_url TEXT,
  prize_amount TEXT,
  deadline TIMESTAMPTZ,
  register_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_projects_creator ON public.projects(creator_id);
CREATE INDEX idx_projects_category ON public.projects(category);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_tasks_project_status ON public.project_tasks(project_id, status, position);
CREATE INDEX idx_project_applications_project ON public.project_applications(project_id);
CREATE INDEX idx_project_activity_project ON public.project_activity(project_id, created_at DESC);
CREATE INDEX idx_project_comments_project ON public.project_comments(project_id, created_at);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_banners ENABLE ROW LEVEL SECURITY;

-- Helper: is project member
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

-- Helper: is project creator
CREATE OR REPLACE FUNCTION public.is_project_creator(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND creator_id = _user_id
  );
$$;

-- Projects policies
CREATE POLICY "Public projects viewable by all auth; private only by members"
  ON public.projects FOR SELECT TO authenticated
  USING (is_public = true OR public.is_project_member(id, auth.uid()) OR creator_id = auth.uid());

CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their projects"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

-- Project members policies
CREATE POLICY "Project members viewable by authenticated"
  ON public.project_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can join via creator add or accepted application"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_project_creator(project_id, auth.uid())
  );

CREATE POLICY "Users can leave; creator can remove"
  ON public.project_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_project_creator(project_id, auth.uid()));

-- Applications policies
CREATE POLICY "Applicants and creators can view applications"
  ON public.project_applications FOR SELECT TO authenticated
  USING (auth.uid() = applicant_id OR public.is_project_creator(project_id, auth.uid()));

CREATE POLICY "Users can apply to projects"
  ON public.project_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Creators can update applications"
  ON public.project_applications FOR UPDATE TO authenticated
  USING (public.is_project_creator(project_id, auth.uid()) OR auth.uid() = applicant_id);

CREATE POLICY "Applicants can withdraw"
  ON public.project_applications FOR DELETE TO authenticated
  USING (auth.uid() = applicant_id OR public.is_project_creator(project_id, auth.uid()));

-- Tasks policies
CREATE POLICY "Tasks viewable by members or on public projects"
  ON public.project_tasks FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true)
  );

CREATE POLICY "Members can create tasks"
  ON public.project_tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can update tasks"
  ON public.project_tasks FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can delete tasks"
  ON public.project_tasks FOR DELETE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

-- Files policies
CREATE POLICY "Files viewable by members or public projects"
  ON public.project_files FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true)
  );

CREATE POLICY "Members can add files"
  ON public.project_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Uploaders can delete their files"
  ON public.project_files FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_project_creator(project_id, auth.uid()));

-- Activity policies
CREATE POLICY "Activity viewable by members or public projects"
  ON public.project_activity FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true)
  );

CREATE POLICY "Members can post activity"
  ON public.project_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Authors can delete activity"
  ON public.project_activity FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments viewable by members or public projects"
  ON public.project_comments FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true)
  );

CREATE POLICY "Members can post comments"
  ON public.project_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Authors can delete comments"
  ON public.project_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Hackathon banners policies (read-only for all auth users; manage via service role)
CREATE POLICY "Banners viewable by authenticated"
  ON public.hackathon_banners FOR SELECT TO authenticated
  USING (true);

-- Auto-add creator as member trigger
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'creator')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_handle_new_project
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- Sync member count
CREATE OR REPLACE FUNCTION public.sync_project_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects SET member_count = member_count + 1 WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_sync_project_member_count
  AFTER INSERT OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_member_count();

-- updated_at triggers
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_project_applications_updated_at
  BEFORE UPDATE ON public.project_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
