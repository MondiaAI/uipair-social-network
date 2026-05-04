-- Trigger-only functions: revoke from PUBLIC entirely
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_circle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_circle_member_count() FROM PUBLIC, anon, authenticated;

-- is_circle_member is used inside RLS policies (runs as definer there); revoke from anon
REVOKE EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) FROM PUBLIC, anon;