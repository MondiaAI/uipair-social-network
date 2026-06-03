-- ============== CIRCLE INVITES ==============
CREATE TABLE IF NOT EXISTS public.circle_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL,
  created_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT lower(replace(gen_random_uuid()::text, '-', '')),
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_circle_invites_circle ON public.circle_invites(circle_id);
CREATE INDEX idx_circle_invites_token ON public.circle_invites(token);

ALTER TABLE public.circle_invites ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can look up an invite by token (needed to redeem)
CREATE POLICY "Authenticated can view invites"
  ON public.circle_invites FOR SELECT TO authenticated USING (true);

CREATE POLICY "Leaders create invites"
  ON public.circle_invites FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.leader_id = auth.uid())
  );

CREATE POLICY "Leaders update their invites"
  ON public.circle_invites FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.leader_id = auth.uid()));

CREATE POLICY "Leaders delete their invites"
  ON public.circle_invites FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.leader_id = auth.uid()));

-- Redeem function: increments use_count atomically when a member joins via invite
CREATE OR REPLACE FUNCTION public.redeem_circle_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.circle_invites;
  c public.circles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO inv FROM public.circle_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT inv.is_active THEN RAISE EXCEPTION 'Invite is no longer active' USING ERRCODE = 'P0001'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'Invite has expired' USING ERRCODE = 'P0001'; END IF;
  IF inv.max_uses IS NOT NULL AND inv.use_count >= inv.max_uses THEN RAISE EXCEPTION 'Invite usage limit reached' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO c FROM public.circles WHERE id = inv.circle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle not found' USING ERRCODE = 'P0002'; END IF;
  IF c.is_premium THEN RAISE EXCEPTION 'Premium circles require a subscription' USING ERRCODE = 'P0001'; END IF;

  -- Add membership (idempotent)
  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (inv.circle_id, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.circle_invites SET use_count = use_count + 1 WHERE id = inv.id;

  RETURN inv.circle_id;
END;
$$;

-- ============== CIRCLE ANNOUNCEMENTS ==============
CREATE TABLE IF NOT EXISTS public.circle_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_circle_announcements_circle ON public.circle_announcements(circle_id, created_at DESC);

ALTER TABLE public.circle_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Announcements viewable by authenticated"
  ON public.circle_announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Leaders post announcements"
  ON public.circle_announcements FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.leader_id = auth.uid())
  );

CREATE POLICY "Leaders update announcements"
  ON public.circle_announcements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.leader_id = auth.uid()));

CREATE POLICY "Leaders delete announcements"
  ON public.circle_announcements FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.leader_id = auth.uid()));

CREATE TRIGGER trg_announcements_updated
  BEFORE UPDATE ON public.circle_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();