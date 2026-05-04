
CREATE OR REPLACE FUNCTION public.enforce_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Block completing onboarding without accepted terms
  IF NEW.onboarding_completed = true AND NEW.terms_accepted_at IS NULL THEN
    RAISE EXCEPTION 'Cannot complete onboarding without accepting the Terms of Service and Privacy Policy'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Prevent clearing a previously-set terms acceptance
  IF TG_OP = 'UPDATE'
     AND OLD.terms_accepted_at IS NOT NULL
     AND NEW.terms_accepted_at IS NULL THEN
    RAISE EXCEPTION 'terms_accepted_at cannot be cleared once set'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_terms_acceptance_trg ON public.profiles;

CREATE TRIGGER enforce_terms_acceptance_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_terms_acceptance();
