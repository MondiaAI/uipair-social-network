
ALTER TABLE public.group_chats ADD COLUMN IF NOT EXISTS graduation_year integer;

-- Drop old partial index keyed on (university, lower(name))
DROP INDEX IF EXISTS public.group_chats_alumni_unique_per_uni;

-- New partial unique index includes graduation_year
CREATE UNIQUE INDEX IF NOT EXISTS group_chats_alumni_unique_per_uni_year
  ON public.group_chats (university, lower(name), graduation_year)
  WHERE kind = 'alumni';

CREATE OR REPLACE FUNCTION public.tg_validate_alumni_group_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nearest integer;
BEGIN
  IF NEW.kind = 'alumni' THEN
    IF NEW.university IS NULL OR length(btrim(NEW.university)) = 0 THEN
      RAISE EXCEPTION 'Alumni communities require a university'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.graduation_year IS NULL THEN
      RAISE EXCEPTION 'Alumni communities require a class year (e.g. 2020)'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.graduation_year < 1900 OR NEW.graduation_year > extract(year from now())::int + 1 THEN
      RAISE EXCEPTION 'Class year % is not valid', NEW.graduation_year
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE kind = 'alumni'
        AND university = NEW.university
        AND lower(name) = lower(NEW.name)
        AND graduation_year = NEW.graduation_year
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      SELECT graduation_year INTO nearest
      FROM public.group_chats
      WHERE kind = 'alumni'
        AND university = NEW.university
        AND lower(name) = lower(NEW.name)
        AND graduation_year IS NOT NULL
      ORDER BY abs(graduation_year - NEW.graduation_year) ASC, graduation_year DESC
      LIMIT 1;
      RAISE EXCEPTION 'An alumni community named "%" already exists for % (Class of %). Try a different cohort year or rename it.',
        NEW.name, NEW.university, COALESCE(nearest, NEW.graduation_year)
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
