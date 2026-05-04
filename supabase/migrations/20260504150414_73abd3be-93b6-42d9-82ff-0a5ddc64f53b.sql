CREATE TABLE public.match_dismissals (
  user_id uuid NOT NULL,
  dismissed_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dismissed_id)
);

ALTER TABLE public.match_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dismissals"
  ON public.match_dismissals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own dismissals"
  ON public.match_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own dismissals"
  ON public.match_dismissals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_match_dismissals_user ON public.match_dismissals(user_id);