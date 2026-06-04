
-- Course videos: visibility + link to source live session
ALTER TABLE public.course_videos
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL;

-- Restrict SELECT so hidden recordings are only visible to uploader or project creator
DROP POLICY IF EXISTS "Project members view course videos" ON public.course_videos;
CREATE POLICY "Project members view course videos"
  ON public.course_videos FOR SELECT
  TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    AND (
      is_visible = true
      OR uploader_id = auth.uid()
      OR public.is_project_creator(project_id, auth.uid())
    )
  );

-- Messages: per-side soft delete
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for_sender boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_for_recipient boolean NOT NULL DEFAULT false;
