
-- Restrict date_of_birth column to server-side only (triggers/admin)
REVOKE SELECT (date_of_birth) ON public.profiles FROM authenticated;
REVOKE SELECT (date_of_birth) ON public.profiles FROM anon;

-- Tighten tenant_admins SELECT: only the admin themselves, or other admins of the same tenant
DROP POLICY IF EXISTS "Tenant admins viewable within tenant" ON public.tenant_admins;
CREATE POLICY "Tenant admins viewable by self or other admins"
ON public.tenant_admins
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_tenant_admin(tenant_id, auth.uid())
);
