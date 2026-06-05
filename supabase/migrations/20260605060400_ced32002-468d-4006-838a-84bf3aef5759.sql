
-- Helper: is group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_gid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id=_gid AND user_id=_uid AND role='admin');
$$;

-- Invites table
CREATE TABLE public.group_chat_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chat_invites TO authenticated;
GRANT ALL ON public.group_chat_invites TO service_role;

ALTER TABLE public.group_chat_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view group invites" ON public.group_chat_invites
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "admins can create invites" ON public.group_chat_invites
  FOR INSERT TO authenticated WITH CHECK (public.is_group_admin(group_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "admins can update invites" ON public.group_chat_invites
  FOR UPDATE TO authenticated USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "admins can delete invites" ON public.group_chat_invites
  FOR DELETE TO authenticated USING (public.is_group_admin(group_id, auth.uid()));

-- Redeem invite
CREATE OR REPLACE FUNCTION public.redeem_group_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.group_chat_invites; g public.group_chats;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO inv FROM public.group_chat_invites WHERE token=_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found' USING ERRCODE='P0002'; END IF;
  IF NOT inv.is_active THEN RAISE EXCEPTION 'Invite is no longer active' USING ERRCODE='P0001'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'Invite has expired' USING ERRCODE='P0001'; END IF;
  IF inv.max_uses IS NOT NULL AND inv.use_count >= inv.max_uses THEN RAISE EXCEPTION 'Invite usage limit reached' USING ERRCODE='P0001'; END IF;
  SELECT * INTO g FROM public.group_chats WHERE id=inv.group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found' USING ERRCODE='P0002'; END IF;

  INSERT INTO public.group_chat_members (group_id, user_id, role, tenant_id)
  VALUES (inv.group_id, auth.uid(), 'member', g.tenant_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.group_chat_invites SET use_count = use_count + 1 WHERE id = inv.id;
  RETURN inv.group_id;
END $$;

-- Tighten group_chats policies: only admins update/delete
DROP POLICY IF EXISTS "creators can update group" ON public.group_chats;
DROP POLICY IF EXISTS "creators can delete group" ON public.group_chats;
DROP POLICY IF EXISTS "admins can update group" ON public.group_chats;
DROP POLICY IF EXISTS "admins can delete group" ON public.group_chats;

CREATE POLICY "admins can update group" ON public.group_chats
  FOR UPDATE TO authenticated USING (public.is_group_admin(id, auth.uid()));

CREATE POLICY "admins can delete group" ON public.group_chats
  FOR DELETE TO authenticated USING (public.is_group_admin(id, auth.uid()));

-- Tighten group_chat_members: only admins can add others (members can still self-leave)
DROP POLICY IF EXISTS "members can add others" ON public.group_chat_members;
DROP POLICY IF EXISTS "admins can add members" ON public.group_chat_members;
DROP POLICY IF EXISTS "admins can remove members" ON public.group_chat_members;
DROP POLICY IF EXISTS "admins can update member roles" ON public.group_chat_members;

CREATE POLICY "admins can add members" ON public.group_chat_members
  FOR INSERT TO authenticated WITH CHECK (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "admins can remove members" ON public.group_chat_members
  FOR DELETE TO authenticated USING (
    public.is_group_admin(group_id, auth.uid()) OR user_id = auth.uid()
  );

CREATE POLICY "admins can update member roles" ON public.group_chat_members
  FOR UPDATE TO authenticated USING (public.is_group_admin(group_id, auth.uid()));
