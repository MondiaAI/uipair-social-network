
-- Inherit tenant_id from parent circle when inserting circle_members (covers SECURITY DEFINER + seed paths)
CREATE OR REPLACE FUNCTION public.tg_circle_members_inherit_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.circles WHERE id = NEW.circle_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS circle_members_inherit_tenant ON public.circle_members;
CREATE TRIGGER circle_members_inherit_tenant
BEFORE INSERT ON public.circle_members
FOR EACH ROW EXECUTE FUNCTION public.tg_circle_members_inherit_tenant();

-- 1) Profiles: graduation year
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS graduation_year integer
    CHECK (graduation_year IS NULL OR (graduation_year BETWEEN 1950 AND 2100));

-- 2) Circles: alumni flag
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS is_alumni boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS circles_one_alumni_per_tenant
  ON public.circles (tenant_id) WHERE is_alumni;

CREATE OR REPLACE FUNCTION public.ensure_alumni_circle(_tenant uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing uuid; leader uuid; tname text; new_id uuid;
BEGIN
  SELECT id INTO existing FROM public.circles WHERE tenant_id = _tenant AND is_alumni LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  SELECT user_id INTO leader FROM public.tenant_admins WHERE tenant_id = _tenant LIMIT 1;
  IF leader IS NULL THEN
    SELECT id INTO leader FROM public.profiles WHERE tenant_id = _tenant ORDER BY created_at LIMIT 1;
  END IF;
  IF leader IS NULL THEN RETURN NULL; END IF;

  SELECT name INTO tname FROM public.tenants WHERE id = _tenant;

  INSERT INTO public.circles (name, kind, subject, description, leader_id, scope, is_premium, is_alumni, tenant_id)
  VALUES (
    COALESCE(tname,'University') || ' Alumni Community',
    'social','Alumni',
    'Network of graduates from ' || COALESCE(tname,'this university') || ' — learning, collaborating, and succeeding together.',
    leader,'campus',false,true,_tenant
  ) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.ensure_alumni_circle(t.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tg_ensure_alumni_on_profile_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN PERFORM public.ensure_alumni_circle(NEW.tenant_id); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_ensure_alumni ON public.profiles;
CREATE TRIGGER profiles_ensure_alumni
AFTER INSERT OR UPDATE OF tenant_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_ensure_alumni_on_profile_tenant();

-- Alumni join eligibility
CREATE OR REPLACE FUNCTION public.tg_enforce_alumni_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_alum boolean; gy integer;
BEGIN
  SELECT is_alumni INTO is_alum FROM public.circles WHERE id = NEW.circle_id;
  IF is_alum AND NEW.role <> 'leader' THEN
    SELECT graduation_year INTO gy FROM public.profiles WHERE id = NEW.user_id;
    IF gy IS NULL OR gy > extract(year from now())::int THEN
      RAISE EXCEPTION 'Alumni Community requires a graduation year in the past on your profile' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS circle_members_alumni_check ON public.circle_members;
CREATE TRIGGER circle_members_alumni_check
BEFORE INSERT ON public.circle_members
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_alumni_eligibility();

-- 3) Group chats
CREATE TABLE IF NOT EXISTS public.group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text,
  kind text NOT NULL DEFAULT 'chat' CHECK (kind IN ('study','chat','research','project','other')),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chats TO authenticated;
GRANT ALL ON public.group_chats TO service_role;
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_chat_members (
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chat_members TO authenticated;
GRANT ALL ON public.group_chat_members TO service_role;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chat_messages TO authenticated;
GRANT ALL ON public.group_chat_messages TO service_role;
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gcm_group ON public.group_chat_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gc_tenant ON public.group_chats(tenant_id, last_message_at DESC);

CREATE OR REPLACE FUNCTION public.is_group_member(_gid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_chat_members WHERE group_id = _gid AND user_id = _uid);
$$;

CREATE POLICY "gc_select_members" ON public.group_chats
  FOR SELECT TO authenticated USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "gc_insert_own_tenant" ON public.group_chats
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND tenant_id = public.current_tenant_id());
CREATE POLICY "gc_update_creator" ON public.group_chats
  FOR UPDATE TO authenticated USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
CREATE POLICY "gc_delete_creator" ON public.group_chats
  FOR DELETE TO authenticated USING (creator_id = auth.uid());

CREATE POLICY "gcm_select_members" ON public.group_chat_members
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "gcm_insert" ON public.group_chat_members
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_chats g WHERE g.id = group_id AND g.creator_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "gcm_delete" ON public.group_chat_members
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.group_chats g WHERE g.id = group_id AND g.creator_id = auth.uid())
  );

CREATE POLICY "gcmsg_select" ON public.group_chat_messages
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "gcmsg_insert" ON public.group_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_group_member(group_id, auth.uid())
              AND tenant_id = public.current_tenant_id());
CREATE POLICY "gcmsg_delete_own" ON public.group_chat_messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_add_group_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_chat_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'admin') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS group_chats_add_creator ON public.group_chats;
CREATE TRIGGER group_chats_add_creator
AFTER INSERT ON public.group_chats
FOR EACH ROW EXECUTE FUNCTION public.tg_add_group_creator();

CREATE OR REPLACE FUNCTION public.tg_bump_group_last_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.group_chats SET last_message_at = NEW.created_at WHERE id = NEW.group_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS group_messages_bump ON public.group_chat_messages;
CREATE TRIGGER group_messages_bump
AFTER INSERT ON public.group_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_bump_group_last_message();

DROP TRIGGER IF EXISTS group_chats_updated_at ON public.group_chats;
CREATE TRIGGER group_chats_updated_at BEFORE UPDATE ON public.group_chats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
