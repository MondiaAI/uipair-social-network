
CREATE OR REPLACE FUNCTION pg_temp.normalize_location(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
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

UPDATE public.profiles
SET university = pg_temp.normalize_location(university)
WHERE university IS NOT NULL
  AND university IS DISTINCT FROM pg_temp.normalize_location(university);

UPDATE public.profiles
SET country = pg_temp.normalize_location(country)
WHERE country IS NOT NULL
  AND country IS DISTINCT FROM pg_temp.normalize_location(country);

UPDATE public.circles
SET university = pg_temp.normalize_location(university)
WHERE university IS NOT NULL
  AND university IS DISTINCT FROM pg_temp.normalize_location(university);
