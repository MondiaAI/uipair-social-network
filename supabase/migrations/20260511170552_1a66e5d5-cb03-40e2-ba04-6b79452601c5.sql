
ALTER TABLE public.ambassador_applications
  ADD COLUMN IF NOT EXISTS student_id_card_url text,
  ADD COLUMN IF NOT EXISTS passport_photo_url text,
  ADD COLUMN IF NOT EXISTS full_picture_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ambassador-applications', 'ambassador-applications', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own ambassador docs" ON storage.objects;
CREATE POLICY "Users upload own ambassador docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ambassador-applications' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users read own ambassador docs" ON storage.objects;
CREATE POLICY "Users read own ambassador docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ambassador-applications' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own ambassador docs" ON storage.objects;
CREATE POLICY "Users update own ambassador docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ambassador-applications' AND auth.uid()::text = (storage.foldername(name))[1]);
