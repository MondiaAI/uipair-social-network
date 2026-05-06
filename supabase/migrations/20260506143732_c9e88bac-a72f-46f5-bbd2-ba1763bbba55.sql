-- Allow circle leaders to remove members (in addition to users leaving themselves)
CREATE POLICY "Leaders can remove members from their circles"
  ON public.circle_members
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = circle_members.circle_id
      AND c.leader_id = auth.uid()
  ));

-- Allow circle leaders to view subscription rows for circles they own
CREATE POLICY "Leaders view subscriptions for their circles"
  ON public.circle_subscriptions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = circle_subscriptions.circle_id
      AND c.leader_id = auth.uid()
  ));