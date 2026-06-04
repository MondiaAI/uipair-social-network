
-- Course videos uploaded into Lab projects
CREATE TABLE public.course_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_course_videos_project ON public.course_videos(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_videos TO authenticated;
GRANT ALL ON public.course_videos TO service_role;

ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view course videos"
ON public.course_videos FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members upload course videos"
ON public.course_videos FOR INSERT TO authenticated
WITH CHECK (public.is_project_member(project_id, auth.uid()) AND uploader_id = auth.uid());

CREATE POLICY "Uploader or creator update course videos"
ON public.course_videos FOR UPDATE TO authenticated
USING (uploader_id = auth.uid() OR public.is_project_creator(project_id, auth.uid()));

CREATE POLICY "Uploader or creator delete course videos"
ON public.course_videos FOR DELETE TO authenticated
USING (uploader_id = auth.uid() OR public.is_project_creator(project_id, auth.uid()));

CREATE TRIGGER tr_course_videos_updated_at
BEFORE UPDATE ON public.course_videos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Live sessions (LMS-style live rooms hosted via Jitsi)
CREATE TABLE public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  room_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended')),
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((project_id IS NOT NULL) OR (circle_id IS NOT NULL))
);
CREATE INDEX idx_live_sessions_project ON public.live_sessions(project_id);
CREATE INDEX idx_live_sessions_circle ON public.live_sessions(circle_id);
CREATE INDEX idx_live_sessions_status ON public.live_sessions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view live sessions"
ON public.live_sessions FOR SELECT TO authenticated
USING (
  (project_id IS NOT NULL AND public.is_project_member(project_id, auth.uid()))
  OR (circle_id IS NOT NULL AND public.is_circle_member(circle_id, auth.uid()))
);

CREATE POLICY "Members create live sessions"
ON public.live_sessions FOR INSERT TO authenticated
WITH CHECK (
  host_id = auth.uid() AND (
    (project_id IS NOT NULL AND public.is_project_member(project_id, auth.uid()))
    OR (circle_id IS NOT NULL AND public.is_circle_member(circle_id, auth.uid()))
  )
);

CREATE POLICY "Host updates own live sessions"
ON public.live_sessions FOR UPDATE TO authenticated
USING (host_id = auth.uid());

CREATE POLICY "Host deletes own live sessions"
ON public.live_sessions FOR DELETE TO authenticated
USING (host_id = auth.uid());

CREATE TRIGGER tr_live_sessions_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for course-videos bucket (private; project members read via signed URL)
CREATE POLICY "Project members read course-videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-videos'
  AND EXISTS (
    SELECT 1 FROM public.course_videos cv
    WHERE cv.storage_path = storage.objects.name
      AND public.is_project_member(cv.project_id, auth.uid())
  )
);

CREATE POLICY "Authenticated upload course-videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owner update course-videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner delete course-videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
