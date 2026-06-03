
CREATE OR REPLACE FUNCTION public.normalize_location(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned text;
  parts text[];
  out_parts text[] := ARRAY[]::text[];
  word text;
  lower_word text;
  i int;
  small text[] := ARRAY['of','the','and','at','in','on','for','de','da','do'];
  hyphen_parts text[];
  hyphen_out text[];
  hp text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  cleaned := btrim(regexp_replace(input, '\s+', ' ', 'g'));
  IF cleaned = '' THEN RETURN NULL; END IF;

  parts := string_to_array(cleaned, ' ');
  FOR i IN 1..array_length(parts, 1) LOOP
    word := parts[i];
    lower_word := lower(word);

    IF (length(word) <= 4 AND word = upper(word) AND word ~ '[A-Z]')
       OR (length(lower_word) <= 4 AND lower_word !~ '[aeiouy]') THEN
      out_parts := out_parts || upper(word);
    ELSIF i > 1 AND lower_word = ANY(small) THEN
      out_parts := out_parts || lower_word;
    ELSE
      hyphen_parts := string_to_array(lower_word, '-');
      hyphen_out := ARRAY[]::text[];
      FOREACH hp IN ARRAY hyphen_parts LOOP
        IF hp = '' THEN
          hyphen_out := hyphen_out || hp;
        ELSE
          hyphen_out := hyphen_out || (upper(substr(hp,1,1)) || substr(hp,2));
        END IF;
      END LOOP;
      out_parts := out_parts || array_to_string(hyphen_out, '-');
    END IF;
  END LOOP;

  RETURN array_to_string(out_parts, ' ');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_location(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_location(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.normalize_profile_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.university := public.normalize_location(NEW.university);
  NEW.country    := public.normalize_location(NEW.country);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_circle_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.university := public.normalize_location(NEW.university);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_normalize_location ON public.profiles;
CREATE TRIGGER profiles_normalize_location
BEFORE INSERT OR UPDATE OF university, country ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_location();

DROP TRIGGER IF EXISTS circles_normalize_location ON public.circles;
CREATE TRIGGER circles_normalize_location
BEFORE INSERT OR UPDATE OF university ON public.circles
FOR EACH ROW EXECUTE FUNCTION public.normalize_circle_location();
