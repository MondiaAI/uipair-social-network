
-- Allow any authenticated user to start a 1:1 conversation, as long as they
-- are one of the two participants. Previously required an accepted friend edge,
-- which blocked first-time "new chat" creation.
DROP POLICY IF EXISTS "Friends create conversations" ON public.conversations;
CREATE POLICY "Participants create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_a) OR (auth.uid() = user_b));

-- Storage: ensure avatar / cover upserts work (INSERT covered; explicitly allow
-- UPDATE WITH CHECK on the same folder to handle the upsert path).
DROP POLICY IF EXISTS "Avatars users update own" ON storage.objects;
CREATE POLICY "Avatars users update own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Covers users update own" ON storage.objects;
CREATE POLICY "Covers users update own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
