
-- 1) Hide stripe_account_id from peer reads (mirror date_of_birth pattern)
REVOKE SELECT (stripe_account_id) ON public.profiles FROM authenticated, anon;

-- 2) Tenant admins can read ambassador application files
CREATE POLICY "Tenant admins read ambassador docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ambassador-applications'
  AND EXISTS (
    SELECT 1
    FROM public.ambassador_applications aa
    WHERE aa.user_id::text = (storage.foldername(name))[1]
      AND public.is_tenant_admin(aa.tenant_id, auth.uid())
  )
);

-- 3) Realtime channel authorization: require authenticated subscribers
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
