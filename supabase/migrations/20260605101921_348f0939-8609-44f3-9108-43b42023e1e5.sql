
-- Race-safe uniqueness for alumni group names within a university (case-insensitive).
-- Different years (different names) are still allowed.
CREATE UNIQUE INDEX IF NOT EXISTS group_chats_alumni_unique_per_uni
  ON public.group_chats (university, lower(name))
  WHERE kind = 'alumni';

-- Friendly pre-check trigger to surface a clear error message (the unique index
-- still guarantees correctness under race conditions).
CREATE OR REPLACE FUNCTION public.tg_validate_alumni_group_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'alumni' THEN
    IF NEW.university IS NULL OR length(btrim(NEW.university)) = 0 THEN
      RAISE EXCEPTION 'Alumni communities require a university'
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE kind = 'alumni'
        AND university = NEW.university
        AND lower(name) = lower(NEW.name)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'An alumni community with this name already exists for %.', NEW.university
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_alumni_group_unique ON public.group_chats;
CREATE TRIGGER validate_alumni_group_unique
  BEFORE INSERT OR UPDATE ON public.group_chats
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_alumni_group_unique();
