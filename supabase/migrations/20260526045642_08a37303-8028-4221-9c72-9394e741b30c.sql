
-- 1. Drop overly-permissive same-tenant SELECT policies on private tables
DROP POLICY IF EXISTS "conversations_select_same_tenant" ON public.conversations;
DROP POLICY IF EXISTS "messages_select_same_tenant" ON public.messages;
DROP POLICY IF EXISTS "notifications_select_same_tenant" ON public.notifications;
DROP POLICY IF EXISTS "study_requests_select_same_tenant" ON public.study_requests;

-- 2. Ambassador applications: only owner or tenant admin
DROP POLICY IF EXISTS "ambassador_applications_select_same_tenant" ON public.ambassador_applications;
CREATE POLICY "ambassador_applications_select_owner_or_admin"
ON public.ambassador_applications FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_tenant_admin(tenant_id, auth.uid()));

-- 3. Circle subscriptions: only subscriber or tenant admin
DROP POLICY IF EXISTS "circle_subscriptions_select_same_tenant" ON public.circle_subscriptions;
CREATE POLICY "circle_subscriptions_select_owner_or_admin"
ON public.circle_subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_tenant_admin(tenant_id, auth.uid()));

-- 4. Gig orders: only buyer/seller or admin
DROP POLICY IF EXISTS "gig_orders_select_same_tenant" ON public.gig_orders;
CREATE POLICY "gig_orders_select_parties_or_admin"
ON public.gig_orders FOR SELECT TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR is_tenant_admin(tenant_id, auth.uid()));

-- 5. Resource purchases: only buyer/seller or admin
DROP POLICY IF EXISTS "resource_purchases_select_same_tenant" ON public.resource_purchases;
CREATE POLICY "resource_purchases_select_parties_or_admin"
ON public.resource_purchases FOR SELECT TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR is_tenant_admin(tenant_id, auth.uid()));

-- 6. Profiles: tighten SELECT — remove `tenant_id IS NULL` public read
DROP POLICY IF EXISTS "Profiles same-tenant or self" ON public.profiles;
CREATE POLICY "Profiles self or same tenant"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR (tenant_id IS NOT NULL AND tenant_id = current_tenant_id()));

-- 7. Profiles: block self-assigning privileged fields via trigger
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role (server-side admin) to set anything
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_pro IS DISTINCT FROM OLD.is_pro
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.reputation_score IS DISTINCT FROM OLD.reputation_score
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id THEN
    RAISE EXCEPTION 'Cannot modify privileged profile fields (is_pro, is_verified, reputation_score, stripe_account_id) from client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_privileged_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- 8. Bounties: only poster or claimer can update (remove status='open' bypass)
DROP POLICY IF EXISTS "Poster or claimer update" ON public.bounties;
CREATE POLICY "Poster or claimer update"
ON public.bounties FOR UPDATE TO authenticated
USING (auth.uid() = poster_id OR auth.uid() = claimer_id);

-- 9. Tenant admin self-claim: only when no admins exist yet for that tenant
DROP POLICY IF EXISTS "Users can claim ownership of tenants they create" ON public.tenant_admins;
CREATE POLICY "First admin can claim empty tenant"
ON public.tenant_admins FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (SELECT 1 FROM public.tenant_admins ta WHERE ta.tenant_id = tenant_admins.tenant_id)
);

-- 10. Resources paywall: replace permissive SELECTs so file_url is gated by purchase
DROP POLICY IF EXISTS "Resources viewable by authenticated" ON public.resources;
DROP POLICY IF EXISTS "resources_select_same_tenant" ON public.resources;

-- Free resources OR own resources OR purchased OR admin
CREATE POLICY "Resources select gated by purchase"
ON public.resources FOR SELECT TO authenticated
USING (
  is_active = true
  AND (
    price_cents = 0
    OR auth.uid() = uploader_id
    OR is_tenant_admin(tenant_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.resource_purchases rp
      WHERE rp.resource_id = resources.id AND rp.buyer_id = auth.uid()
    )
  )
);
