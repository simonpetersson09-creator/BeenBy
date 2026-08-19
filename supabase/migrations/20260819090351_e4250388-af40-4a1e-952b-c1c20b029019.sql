-- ─────────────────────────────────────────────
-- 1. Revocable family access
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.circle_bans (
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid,
  PRIMARY KEY (family_circle_id, user_id)
);
GRANT SELECT ON public.circle_bans TO authenticated;
GRANT ALL ON public.circle_bans TO service_role;
ALTER TABLE public.circle_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read bans" ON public.circle_bans;
CREATE POLICY "members read bans" ON public.circle_bans
  FOR SELECT TO authenticated USING (public.is_circle_member(family_circle_id));

-- Rotating the code + expiring open invitations is what actually revokes access.
CREATE OR REPLACE FUNCTION public.revoke_circle_access(_circle uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_code text;
BEGIN
  new_code := public.generate_family_code();
  UPDATE public.family_circles SET family_code = new_code WHERE id = _circle;
  UPDATE public.invitations
     SET expires_at = now() - interval '1 second',
         used_at = COALESCE(used_at, now())
   WHERE family_circle_id = _circle AND expires_at > now();
  RETURN new_code;
END;
$function$;
REVOKE ALL ON FUNCTION public.revoke_circle_access(uuid) FROM public;

-- Circle creator removes another member: membership gone, code rotated, banned.
CREATE OR REPLACE FUNCTION public.remove_family_member(_circle uuid, _user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _user IS NULL OR _circle IS NULL THEN RETURN false; END IF;
  IF NOT public.is_circle_creator(_circle) THEN RETURN false; END IF;
  IF _user = uid THEN RETURN false; END IF;

  DELETE FROM public.family_members WHERE family_circle_id = _circle AND user_id = _user;
  INSERT INTO public.circle_bans(family_circle_id, user_id, removed_by)
  VALUES (_circle, _user, uid)
  ON CONFLICT (family_circle_id, user_id) DO UPDATE SET removed_at = now(), removed_by = uid;
  PERFORM public.revoke_circle_access(_circle);
  PERFORM public.log_security_event('member_removed', _user::text, uid);
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_family_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_family_member(uuid, uuid) TO authenticated;

-- Leaving voluntarily: membership ends immediately, no ban (can rejoin later).
CREATE OR REPLACE FUNCTION public.leave_family_circle(_circle uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _circle IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.family_members
                 WHERE family_circle_id = _circle AND user_id = uid) THEN
    RETURN false;
  END IF;
  DELETE FROM public.family_members WHERE family_circle_id = _circle AND user_id = uid;
  DELETE FROM public.planned_visits
   WHERE family_circle_id = _circle AND user_id = uid AND planned_date >= current_date;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.leave_family_circle(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.leave_family_circle(uuid) TO authenticated;

-- Ban check inside join_circle (token AND code paths).
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
  ELSIF _code IS NOT NULL THEN
    SELECT id INTO c_id FROM public.family_circles WHERE family_code = upper(trim(_code));
    IF c_id IS NULL THEN
      INSERT INTO public.security_events(user_id, kind, detail) VALUES (uid, 'invite_failed', 'join code');
      RETURN NULL;
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  -- Removed members can never come back with an old code or link.
  IF EXISTS (SELECT 1 FROM public.circle_bans b WHERE b.family_circle_id = c_id AND b.user_id = uid) THEN
    INSERT INTO public.security_events(user_id, kind, detail) VALUES (uid, 'join_banned', c_id::text);
    RETURN NULL;
  END IF;

  IF inv.id IS NOT NULL THEN
    UPDATE public.invitations SET used_at = COALESCE(used_at, now()) WHERE id = inv.id;
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

-- ─────────────────────────────────────────────
-- 2. Account deletion
-- ─────────────────────────────────────────────
/*
  Removes everything that is personal data for the caller and returns the
  Storage paths the server function must delete afterwards. Other members'
  own visits, plans and messages are never touched.
*/
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS TABLE(image_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT m.image_path FROM public.messages m
    WHERE m.user_id = uid AND m.image_path IS NOT NULL;

  DELETE FROM public.device_tokens WHERE user_id = uid;
  DELETE FROM public.messages WHERE user_id = uid;
  DELETE FROM public.planned_visits WHERE user_id = uid;
  DELETE FROM public.visits WHERE user_id = uid;
  DELETE FROM public.family_members WHERE user_id = uid;
  DELETE FROM public.premium_entitlements WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  PERFORM public.log_security_event('account_deleted', NULL, uid);
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;

-- ─────────────────────────────────────────────
-- 3. Consistent behaviour after an expired trial
--    Insert = blocked. Edit/cancel/delete of your OWN rows = always allowed.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "update own planned" ON public.planned_visits;
CREATE POLICY "update own planned" ON public.planned_visits
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());