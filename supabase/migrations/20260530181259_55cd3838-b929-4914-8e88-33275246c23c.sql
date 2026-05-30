
-- Drop tenant-wide SELECT policies that bypass owner/participant scoping
DROP POLICY IF EXISTS "conversation_mutes_select_same_tenant" ON public.conversation_mutes;
DROP POLICY IF EXISTS "friend_requests_select_same_tenant" ON public.friend_requests;
DROP POLICY IF EXISTS "match_dismissals_select_same_tenant" ON public.match_dismissals;
DROP POLICY IF EXISTS "project_join_requests_select_same_tenant" ON public.project_join_requests;

-- Restrict stripe_account_id column on profiles so peers cannot read it
REVOKE SELECT (stripe_account_id) ON public.profiles FROM authenticated, anon;
GRANT SELECT (stripe_account_id) ON public.profiles TO service_role;

-- Tighten tenant_admins SELECT to own tenant or own row
DROP POLICY IF EXISTS "Admins viewable by authenticated" ON public.tenant_admins;
DROP POLICY IF EXISTS "Tenant admins viewable by their members" ON public.tenant_admins;
CREATE POLICY "Tenant admins viewable within tenant"
  ON public.tenant_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR tenant_id = public.current_tenant_id());

-- Restrict universities INSERT to tenant admins only
DROP POLICY IF EXISTS "Authenticated users can add universities" ON public.universities;
CREATE POLICY "Tenant admins can add universities"
  ON public.universities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(public.current_tenant_id(), auth.uid()));

-- Storage: allow ambassador applicants to delete their own files
DROP POLICY IF EXISTS "Applicants delete own ambassador files" ON storage.objects;
CREATE POLICY "Applicants delete own ambassador files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ambassador-applications'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Storage: allow buyers to download resources they purchased
DROP POLICY IF EXISTS "Buyers can read purchased resources" ON storage.objects;
CREATE POLICY "Buyers can read purchased resources"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND EXISTS (
      SELECT 1 FROM public.resource_purchases rp
      JOIN public.resources r ON r.id = rp.resource_id
      WHERE rp.buyer_id = auth.uid()
        AND r.file_url LIKE '%' || name || '%'
    )
  );
