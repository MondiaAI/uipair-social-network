
-- Hide Stripe payment processor IDs from all client roles on circle_subscriptions
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.circle_subscriptions FROM authenticated, anon;

-- Tighten realtime channel authorization with topic-scoped policies
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;

-- Allow authenticated users to subscribe only to topics that include their user id
-- App convention: private topics are namespaced with the user's uid or a conversation id they participate in.
CREATE POLICY "Realtime: user-scoped topics"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    -- self-scoped topics (notifications, user channels)
    realtime.topic() LIKE '%' || auth.uid()::text || '%'
    -- conversation topics where the user is a participant
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE realtime.topic() LIKE '%' || c.id::text || '%'
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
    -- gig order topics where the user is buyer or seller
    OR EXISTS (
      SELECT 1 FROM public.gig_orders o
      WHERE realtime.topic() LIKE '%' || o.id::text || '%'
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
    -- generic postgres_changes channels (no user-specific topic) — fall back to table RLS
    OR realtime.topic() IN ('realtime', 'postgres_changes', 'schema-db-changes')
  )
);
