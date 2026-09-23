CREATE OR REPLACE FUNCTION public.create_family_circle(
  _person_name text,
  _my_name text,
  _color text,
  _timezone text DEFAULT 'Europe/Stockholm',
  _address text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
)
RETURNS TABLE(out_circle_id uuid, out_family_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  new_code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF coalesce(btrim(_person_name), '') = '' OR coalesce(btrim(_my_name), '') = '' THEN
    RAISE EXCEPTION 'missing_name';
  END IF;

  PERFORM public.enforce_rate_limit('circle_create_day', 20, 86400);

  INSERT INTO public.family_circles(name, timezone, created_by)
  VALUES (btrim(_person_name), coalesce(nullif(btrim(_timezone), ''), 'Europe/Stockholm'), uid)
  RETURNING id, family_code INTO new_id, new_code;

  INSERT INTO public.persons(family_circle_id, name, address, location_latitude, location_longitude)
  VALUES (new_id, btrim(_person_name), nullif(btrim(coalesce(_address, '')), ''), _lat, _lng);

  INSERT INTO public.family_members(family_circle_id, user_id, personal_color, role)
  VALUES (new_id, uid, coalesce(nullif(btrim(_color), ''), 'blue'), 'owner');

  INSERT INTO public.profiles(id, name) VALUES (uid, btrim(_my_name))
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  out_circle_id := new_id;
  out_family_code := new_code;
  RETURN NEXT;
END;
$fn$;