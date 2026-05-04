
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TYPE public.workspace_type AS ENUM ('document', 'board', 'mindmap', 'thread');
CREATE TYPE public.workspace_status AS ENUM ('active', 'draft', 'complete');

CREATE TABLE public.project_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type public.workspace_type NOT NULL DEFAULT 'document',
  status public.workspace_status NOT NULL DEFAULT 'active',
  content text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, type)
);

ALTER TABLE public.project_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspaces viewable by members or public projects"
  ON public.project_workspaces FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public = true));

CREATE POLICY "Members can insert workspaces"
  ON public.project_workspaces FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can update workspaces"
  ON public.project_workspaces FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Creators can delete workspaces"
  ON public.project_workspaces FOR DELETE TO authenticated
  USING (public.is_project_creator(project_id, auth.uid()));

CREATE TRIGGER project_workspaces_touch
  BEFORE UPDATE ON public.project_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_workspaces;
