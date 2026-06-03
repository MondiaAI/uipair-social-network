-- ============ Friend requests ============
CREATE TYPE public.friend_request_status AS ENUM ('pending','accepted','declined','canceled');

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  status public.friend_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friend_requests_distinct CHECK (sender_id <> recipient_id),
  CONSTRAINT friend_requests_unique_pair UNIQUE (sender_id, recipient_id)
);

CREATE INDEX idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX idx_friend_requests_recipient ON public.friend_requests(recipient_id);
CREATE INDEX idx_friend_requests_status ON public.friend_requests(status);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own friend requests" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users send friend requests" ON public.friend_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Participants update friend requests" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Participants delete friend requests" ON public.friend_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE TRIGGER friend_requests_updated_at
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: are two users friends (accepted in either direction)?
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE status = 'accepted'
      AND ((sender_id = _a AND recipient_id = _b)
        OR (sender_id = _b AND recipient_id = _a))
  );
$$;

-- ============ Conversations & messages (1:1) ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_distinct CHECK (user_a <> user_b),
  CONSTRAINT conversations_ordered CHECK (user_a < user_b),
  CONSTRAINT conversations_unique UNIQUE (user_a, user_b)
);

CREATE INDEX idx_conversations_user_a ON public.conversations(user_a);
CREATE INDEX idx_conversations_user_b ON public.conversations(user_b);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Only friends can create a conversation, and only if they are a participant
CREATE POLICY "Friends create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND public.are_friends(user_a, user_b)
  );

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

CREATE POLICY "Participants send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
        AND public.are_friends(c.user_a, c.user_b)
    )
  );

CREATE POLICY "Senders delete own messages" ON public.messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- bump conversation last_message_at on new message
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER messages_bump_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;