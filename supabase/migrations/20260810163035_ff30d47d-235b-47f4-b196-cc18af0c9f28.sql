CREATE OR REPLACE FUNCTION public.generate_family_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.family_circles WHERE family_code = result);
  END LOOP;
  RETURN result;
END;
$$;

ALTER TABLE public.family_circles
  ALTER COLUMN family_code SET DEFAULT public.generate_family_code();

UPDATE public.family_circles
SET family_code = public.generate_family_code()
WHERE family_code ~ '[^A-Z0-9]';