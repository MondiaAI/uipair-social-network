ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE OR REPLACE FUNCTION public.enforce_age_requirement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.onboarding_completed = true THEN
    IF NEW.date_of_birth IS NULL THEN
      RAISE EXCEPTION 'Date of birth is required'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.date_of_birth > (current_date - interval '18 years') THEN
      RAISE EXCEPTION 'You must be at least 18 years old to use UiPair'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_age_requirement_trg ON public.profiles;
CREATE TRIGGER enforce_age_requirement_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_age_requirement();