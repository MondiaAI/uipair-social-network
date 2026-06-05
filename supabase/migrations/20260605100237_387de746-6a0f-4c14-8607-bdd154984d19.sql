
-- 1. Columns on group_chats
ALTER TABLE public.group_chats
  ADD COLUMN IF NOT EXISTS university text,
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

-- Normalize university name on insert/update for alumni groups
CREATE OR REPLACE FUNCTION public.normalize_group_chat_university()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.university IS NOT NULL THEN
    NEW.university := public.normalize_location(NEW.university);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalize_group_chat_university ON public.group_chats;
CREATE TRIGGER trg_normalize_group_chat_university
  BEFORE INSERT OR UPDATE ON public.group_chats
  FOR EACH ROW EXECUTE FUNCTION public.normalize_group_chat_university();

-- 2. Discovery policy: any signed-in user can SELECT alumni group_chats rows
DROP POLICY IF EXISTS gc_select_alumni_discoverable ON public.group_chats;
CREATE POLICY gc_select_alumni_discoverable
  ON public.group_chats FOR SELECT TO authenticated
  USING (kind = 'alumni');

-- 3. Join requests table
CREATE TABLE IF NOT EXISTS public.group_chat_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chat_join_requests TO authenticated;
GRANT ALL ON public.group_chat_join_requests TO service_role;

ALTER TABLE public.group_chat_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY gcjr_select_own_or_admin
  ON public.group_chat_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

CREATE POLICY gcjr_insert_own
  ON public.group_chat_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY gcjr_delete_own
  ON public.group_chat_join_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id, auth.uid()));

CREATE TRIGGER trg_gcjr_updated_at
  BEFORE UPDATE ON public.group_chat_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Approve / decline RPCs (admins only)
CREATE OR REPLACE FUNCTION public.approve_group_join_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r public.group_chat_join_requests;
  g public.group_chats;
  approver uuid := auth.uid();
BEGIN
  IF approver IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.group_chat_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO g FROM public.group_chats WHERE id = r.group_id;
  IF NOT public.is_group_admin(g.id, approver) THEN
    RAISE EXCEPTION 'Only group admins can approve' USING ERRCODE='42501';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already resolved' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.group_chat_members (group_id, user_id, role, tenant_id)
  VALUES (g.id, r.user_id, 'member', g.tenant_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.group_chat_join_requests
    SET status = 'approved', updated_at = now()
    WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, type, content, related_id)
  VALUES (r.user_id, 'group_join_approved',
    'Your request to join "' || g.name || '" was approved', g.id);
END $$;

CREATE OR REPLACE FUNCTION public.decline_group_join_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r public.group_chat_join_requests;
  g public.group_chats;
  approver uuid := auth.uid();
BEGIN
  IF approver IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.group_chat_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO g FROM public.group_chats WHERE id = r.group_id;
  IF NOT public.is_group_admin(g.id, approver) THEN
    RAISE EXCEPTION 'Only group admins can decline' USING ERRCODE='42501';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already resolved' USING ERRCODE='P0001'; END IF;

  UPDATE public.group_chat_join_requests
    SET status = 'declined', updated_at = now()
    WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, type, content, related_id)
  VALUES (r.user_id, 'group_join_declined',
    'Your request to join "' || g.name || '" was declined', g.id);
END $$;
