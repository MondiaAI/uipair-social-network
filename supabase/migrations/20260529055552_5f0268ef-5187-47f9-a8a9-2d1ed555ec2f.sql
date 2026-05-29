-- Repair message delivery: conversation participants can send messages in their own conversations.
DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);

-- Make profile updates safer and explicit for client-side PATCH requests.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Refresh avatar/cover storage policies so uploads and re-uploads work reliably.
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars users upload own" ON storage.objects;
DROP POLICY IF EXISTS "Avatars users update own" ON storage.objects;
DROP POLICY IF EXISTS "Avatars users delete own" ON storage.objects;

CREATE POLICY "Avatars public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Avatars users upload own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars users update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars users delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Covers public read" ON storage.objects;
DROP POLICY IF EXISTS "Covers users upload own" ON storage.objects;
DROP POLICY IF EXISTS "Covers users update own" ON storage.objects;
DROP POLICY IF EXISTS "Covers users delete own" ON storage.objects;

CREATE POLICY "Covers public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'covers');

CREATE POLICY "Covers users upload own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Covers users update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Covers users delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Refresh private resource/file-sharing storage policies.
DROP POLICY IF EXISTS "Resources owners read" ON storage.objects;
DROP POLICY IF EXISTS "Resources users upload own" ON storage.objects;
DROP POLICY IF EXISTS "Resources users update own" ON storage.objects;
DROP POLICY IF EXISTS "Resources users delete own" ON storage.objects;

CREATE POLICY "Resources owners read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'resources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Resources users upload own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Resources users update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'resources' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'resources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Resources users delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'resources' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Demo-ready partner match rows for precomputed recommendations.
CREATE TABLE IF NOT EXISTS public.partner_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  matched_user_id uuid NOT NULL,
  match_score integer NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  shared_skills text[] NOT NULL DEFAULT '{}',
  availability_overlap text[] NOT NULL DEFAULT '{}',
  match_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_matches_distinct_users CHECK (user_id <> matched_user_id),
  CONSTRAINT partner_matches_unique_pair UNIQUE (user_id, matched_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_matches TO authenticated;
GRANT ALL ON public.partner_matches TO service_role;

ALTER TABLE public.partner_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own partner matches" ON public.partner_matches;
CREATE POLICY "Users view own partner matches"
ON public.partner_matches
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own partner matches" ON public.partner_matches;
CREATE POLICY "Users manage own partner matches"
ON public.partner_matches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own partner matches" ON public.partner_matches;
CREATE POLICY "Users update own partner matches"
ON public.partner_matches
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own partner matches" ON public.partner_matches;
CREATE POLICY "Users delete own partner matches"
ON public.partner_matches
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_partner_matches_user_score
ON public.partner_matches(user_id, match_score DESC);

DROP TRIGGER IF EXISTS partner_matches_updated_at ON public.partner_matches;
CREATE TRIGGER partner_matches_updated_at
BEFORE UPDATE ON public.partner_matches
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();