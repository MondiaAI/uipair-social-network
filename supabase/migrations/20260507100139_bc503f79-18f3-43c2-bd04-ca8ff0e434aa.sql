
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
  IF requester IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002'; END IF;

  IF EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = requester) THEN
    RAISE EXCEPTION 'You are already a member' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO requester_name
  FROM public.profiles WHERE id = requester;

  INSERT INTO public.notifications (user_id, type, content, related_id)
  VALUES (p.creator_id, 'project_join_request',
    requester_name || ' requested to join your project: ' || p.name,
    _project_id);
END;
$$;
