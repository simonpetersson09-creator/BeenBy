CREATE OR REPLACE FUNCTION public.join_circle(_name text, _color text, _token text DEFAULT NULL::text, _code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_id uuid;
  inv public.invitations%ROWTYPE;
  uid uuid := auth.uid();
  chosen text;
  palette text[] := ARRAY['blue','green','orange','purple','terracotta','teal','pink','sand'];
  candidate text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Brute-force guard. NOTE: failures below must RETURN (not RAISE), because a
  -- raised exception rolls back this counter and the guard would never bite.
  IF NOT public.consume_rate_limit('join:' || uid::text, 10, 300) THEN
    INSERT INTO public.security_events(user_id, kind, detail)
    VALUES (uid, 'invite_bruteforce', 'join_circle rate limit');
    RETURN NULL;
  END IF;

  IF _token IS NOT NULL THEN
    SELECT * INTO inv FROM public.invitations WHERE invite_token = _token;
    IF NOT FOUND THEN
      INSERT INTO public.security_events(user_id, kind, detail) VALUES (uid, 'invite_failed', 'join token');
      RETURN NULL;
    END IF;
    IF inv.expires_at < now() THEN RAISE EXCEPTION 'expired_invite'; END IF;
    c_id := inv.family_circle_id;
    UPDATE public.invitations SET used_at = COALESCE(used_at, now()) WHERE id = inv.id;
  ELSIF _code IS NOT NULL THEN
    SELECT id INTO c_id FROM public.family_circles WHERE family_code = upper(trim(_code));
    IF c_id IS NULL THEN
      INSERT INTO public.security_events(user_id, kind, detail) VALUES (uid, 'invite_failed', 'join code');
      RETURN NULL;
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  UPDATE public.profiles SET name = _name WHERE id = uid AND coalesce(_name,'') <> '';

  chosen := _color;
  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_circle_id = c_id AND personal_color = chosen AND user_id <> uid
  ) THEN
    chosen := NULL;
    FOREACH candidate IN ARRAY palette LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_circle_id = c_id AND personal_color = candidate
      ) THEN
        chosen := candidate;
        EXIT;
      END IF;
    END LOOP;
    IF chosen IS NULL THEN
      chosen := _color || '-' || substr(uid::text, 1, 4);
    END IF;
  END IF;

  INSERT INTO public.family_members (family_circle_id, user_id, personal_color)
  VALUES (c_id, uid, chosen)
  ON CONFLICT (family_circle_id, user_id) DO UPDATE SET personal_color = EXCLUDED.personal_color;

  RETURN c_id;
END; $function$;