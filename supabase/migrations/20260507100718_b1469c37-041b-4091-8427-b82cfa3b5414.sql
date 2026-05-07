
CREATE TYPE public.project_join_request_status AS ENUM ('pending','approved','declined');

CREATE TABLE public.project_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status public.project_join_request_status NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters and creators can view"
  ON public.project_join_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_project_creator(project_id, auth.uid()));

CREATE POLICY "Requesters can withdraw"
  ON public.project_join_requests FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_project_creator(project_id, auth.uid()));

CREATE TRIGGER trg_pjr_updated_at BEFORE UPDATE ON public.project_join_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Replace request fn to use the new table
CREATE OR REPLACE FUNCTION public.request_project_join(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.projects;
  requester uuid := auth.uid();
  requester_name text;
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = requester) THEN
    RAISE EXCEPTION 'You are already a member' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.project_join_requests (project_id, user_id, status)
  VALUES (_project_id, requester, 'pending')
  ON CONFLICT (project_id, user_id) DO UPDATE
    SET status = 'pending', updated_at = now()
  WHERE public.project_join_requests.status <> 'pending';

  SELECT COALESCE(full_name, username, 'Someone') INTO requester_name
  FROM public.profiles WHERE id = requester;

  INSERT INTO public.notifications (user_id, type, content, related_id)
  VALUES (p.creator_id, 'project_join_request',
    requester_name || ' requested to join your project: ' || p.name,
    _project_id);
END;
$$;

-- Approve
CREATE OR REPLACE FUNCTION public.approve_project_join_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.project_join_requests;
  p public.projects;
  approver uuid := auth.uid();
  joiner_name text;
BEGIN
  IF approver IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.project_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO p FROM public.projects WHERE id = r.project_id;
  IF p.creator_id <> approver THEN RAISE EXCEPTION 'Only the project creator can approve' USING ERRCODE = '42501'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already resolved' USING ERRCODE = 'P0001'; END IF;
  IF p.member_count >= p.team_size_limit THEN RAISE EXCEPTION 'Project is full' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (r.project_id, r.user_id, 'other')
  ON CONFLICT DO NOTHING;

  UPDATE public.project_join_requests SET status = 'approved', updated_at = now() WHERE id = _request_id;

  SELECT COALESCE(full_name, username, 'A teammate') INTO joiner_name FROM public.profiles WHERE id = r.user_id;

  INSERT INTO public.notifications (user_id, type, content, related_id)
  VALUES (r.user_id, 'project_join_approved', 'Your request to join "' || p.name || '" was approved', r.project_id);
END;
$$;

-- Decline
CREATE OR REPLACE FUNCTION public.decline_project_join_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.project_join_requests;
  p public.projects;
  approver uuid := auth.uid();
BEGIN
  IF approver IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.project_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO p FROM public.projects WHERE id = r.project_id;
  IF p.creator_id <> approver THEN RAISE EXCEPTION 'Only the project creator can decline' USING ERRCODE = '42501'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already resolved' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.project_join_requests SET status = 'declined', updated_at = now() WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, type, content, related_id)
  VALUES (r.user_id, 'project_join_declined', 'Your request to join "' || p.name || '" was declined', r.project_id);
END;
$$;
