
CREATE TABLE IF NOT EXISTS public.message_attachment_views (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  line_index integer NOT NULL,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, line_index, viewer_id)
);

CREATE INDEX idx_msg_att_views_viewer ON public.message_attachment_views(viewer_id);
CREATE INDEX idx_msg_att_views_message ON public.message_attachment_views(message_id);

GRANT SELECT, INSERT ON public.message_attachment_views TO authenticated;
GRANT ALL ON public.message_attachment_views TO service_role;

ALTER TABLE public.message_attachment_views ENABLE ROW LEVEL SECURITY;

-- Viewer can insert their own view record, only for messages in conversations they participate in,
-- and only for messages they did NOT send.
CREATE POLICY "Recipient inserts own view"
ON public.message_attachment_views
FOR INSERT
TO authenticated
WITH CHECK (
  viewer_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_attachment_views.message_id
      AND m.sender_id <> auth.uid()
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);

-- Viewer sees their own records; sender sees view records on their own messages.
CREATE POLICY "View records visible to viewer and sender"
ON public.message_attachment_views
FOR SELECT
TO authenticated
USING (
  viewer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_attachment_views.message_id
      AND m.sender_id = auth.uid()
  )
);
