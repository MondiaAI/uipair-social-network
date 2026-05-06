REVOKE EXECUTE ON FUNCTION public.redeem_circle_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_circle_invite(text) TO authenticated;