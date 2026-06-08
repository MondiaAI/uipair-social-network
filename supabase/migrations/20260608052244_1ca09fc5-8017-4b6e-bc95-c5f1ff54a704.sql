-- 1) Remove leader policy exposing Stripe identifiers on circle_subscriptions.
DROP POLICY IF EXISTS "Leaders view subscriptions for their circles" ON public.circle_subscriptions;

-- Expose only non-sensitive subscription info to circle leaders via SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.get_circle_subscriptions_for_leader(_circle_id uuid)
RETURNS TABLE (
  id uuid,
  circle_id uuid,
  user_id uuid,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.id,
    cs.circle_id,
    cs.user_id,
    cs.status::text,
    cs.current_period_start,
    cs.current_period_end,
    cs.cancel_at_period_end,
    cs.created_at,
    cs.updated_at
  FROM public.circle_subscriptions cs
  JOIN public.circles c ON c.id = cs.circle_id
  WHERE cs.circle_id = _circle_id
    AND c.leader_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_circle_subscriptions_for_leader(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_circle_subscriptions_for_leader(uuid) TO authenticated;

-- 2) Allow group admins to update join requests (e.g. status -> approved/rejected).
DROP POLICY IF EXISTS "gcjr_update_admin" ON public.group_chat_join_requests;
CREATE POLICY "gcjr_update_admin"
ON public.group_chat_join_requests
FOR UPDATE
TO authenticated
USING (public.is_group_admin(group_id, auth.uid()))
WITH CHECK (public.is_group_admin(group_id, auth.uid()));

-- 3) Prevent bypassing approval-gated group chats. Replace open self-insert policy.
DROP POLICY IF EXISTS "gcm_insert" ON public.group_chat_members;

CREATE POLICY "gcm_insert"
ON public.group_chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_chats g
    WHERE g.id = group_chat_members.group_id
      AND g.creator_id = auth.uid()
  )
  OR public.is_group_admin(group_chat_members.group_id, auth.uid())
  OR (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.group_chats g
        WHERE g.id = group_chat_members.group_id
          AND g.requires_approval = false
      )
      OR EXISTS (
        SELECT 1 FROM public.group_chat_join_requests r
        WHERE r.group_id = group_chat_members.group_id
          AND r.user_id = auth.uid()
          AND r.status = 'approved'
      )
    )
  )
);