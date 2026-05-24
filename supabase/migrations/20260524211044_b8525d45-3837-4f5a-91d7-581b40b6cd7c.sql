
-- 1. Circles: add kind (study | social)
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'study'
  CHECK (kind IN ('study','social'));

-- 2. Tenants: allow authenticated users to create a new university entry
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (true);

-- 3. Tenant admins: when a user creates a tenant, allow them to insert themselves as owner
CREATE POLICY "Users can claim ownership of tenants they create"
ON public.tenant_admins FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Tenant admins viewable by their members"
ON public.tenant_admins FOR SELECT TO authenticated
USING (true);
