CREATE OR REPLACE FUNCTION public.notify_announcement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  circle_name text;
  notif_type text;
  notif_content text;
BEGIN
  SELECT name INTO circle_name FROM public.circles WHERE id = NEW.circle_id;

  IF TG_OP = 'INSERT' THEN
    notif_type := 'announcement_new';
    notif_content := 'New announcement in ' || COALESCE(circle_name, 'a circle') || ': ' || NEW.title;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned AND NEW.is_pinned = true THEN
      notif_type := 'announcement_pinned';
      notif_content := 'Pinned announcement in ' || COALESCE(circle_name, 'a circle') || ': ' || NEW.title;
    ELSIF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
      notif_type := 'announcement_updated';
      notif_content := 'Announcement updated in ' || COALESCE(circle_name, 'a circle') || ': ' || NEW.title;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- related_id now references the announcement so the client can deep-link.
  INSERT INTO public.notifications (user_id, type, content, related_id)
  SELECT cm.user_id, notif_type, notif_content, NEW.id
  FROM public.circle_members cm
  WHERE cm.circle_id = NEW.circle_id
    AND cm.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_announcement_change() FROM PUBLIC, anon, authenticated;