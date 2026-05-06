
-- 1. Fix permissive RLS: universities INSERT must require authenticated user
DROP POLICY IF EXISTS "Authenticated users can add universities" ON public.universities;
CREATE POLICY "Authenticated users can add universities"
  ON public.universities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Remove broad SELECT policies on public storage buckets to prevent listing.
-- Files in public buckets remain accessible via their public CDN URL (getPublicUrl)
-- without needing a storage.objects SELECT policy.
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Covers public read" ON storage.objects;

-- 3. Revoke EXECUTE on SECURITY DEFINER functions from anon and authenticated.
-- Trigger functions and RLS helpers don't need to be callable via PostgREST.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_circle() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_circle_member_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_project() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_project_member_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_creator(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_circle_subscription(uuid, uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM anon, authenticated, PUBLIC;
