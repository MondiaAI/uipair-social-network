CREATE TABLE IF NOT EXISTS public.conversation_mutes (
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

ALTER TABLE public.conversation_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mutes"
  ON public.conversation_mutes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own mutes"
  ON public.conversation_mutes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

CREATE POLICY "Users delete own mutes"
  ON public.conversation_mutes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_mutes;