-- Backfill profiles for any auth users missing a profile row (old accounts)
INSERT INTO public.profiles (id, full_name, username, avatar_url)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email,'@',1) || '_' || substr(u.id::text,1,4)),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;