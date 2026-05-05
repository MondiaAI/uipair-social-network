CREATE POLICY "Recipients mark messages read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() <> sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
)
WITH CHECK (
  auth.uid() <> sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);