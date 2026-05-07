CREATE OR REPLACE FUNCTION public.join_public_project(_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.projects;
  joiner uuid := auth.uid();
  joiner_name text;
BEGIN
  IF joiner IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT p.is_public THEN RAISE EXCEPTION 'This project is private' USING ERRCODE = 'P0001'; END IF;
  IF p.join_fee_cents > 0 THEN RAISE EXCEPTION 'This project requires payment to join' USING ERRCODE = 'P0001'; END IF;
  IF p.member_count >= p.team_size_limit THEN RAISE EXCEPTION 'This project is full' USING ERRCODE = 'P0001'; END IF;

  -- Already a member? bail silently
  IF EXISTS (SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = joiner) THEN
    RETURN _project_id;
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_project_id, joiner, 'other');

  SELECT COALESCE(full_name, username, 'A new teammate') INTO joiner_name
  FROM public.profiles WHERE id = joiner;

  -- Notify joiner
  INSERT INTO public.notifications (user_id, type, content, related_id)
  VALUES (joiner, 'project_joined', 'You joined the project: ' || p.name, _project_id);

  -- Notify creator (only if different)
  IF p.creator_id <> joiner THEN
    INSERT INTO public.notifications (user_id, type, content, related_id)
    VALUES (p.creator_id, 'project_new_member', joiner_name || ' joined your project: ' || p.name, _project_id);
  END IF;

  RETURN _project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_public_project(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_public_project(uuid) TO authenticated;