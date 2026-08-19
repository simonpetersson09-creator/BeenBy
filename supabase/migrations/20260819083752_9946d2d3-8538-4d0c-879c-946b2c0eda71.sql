-- ============================================================
-- BeenBy: abuse protection — rate limiting, validation, logging
-- ============================================================

-- 1. Internal tables (no client access at all) -----------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket, window_start)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access to rate_limits" ON public.rate_limits
  AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  user_id uuid,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_kind_created_idx ON public.security_events (kind, created_at DESC);
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access to security_events" ON public.security_events
  AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.push_dedupe (
  record_id uuid PRIMARY KEY,
  source_table text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_dedupe TO service_role;
ALTER TABLE public.push_dedupe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access to push_dedupe" ON public.push_dedupe
  AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 2. Rate limit primitives ------------------------------------
CREATE OR REPLACE FUNCTION public.log_security_event(_kind text, _detail text DEFAULT NULL, _user uuid DEFAULT auth.uid())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_events (kind, user_id, detail)
  VALUES (_kind, _user, left(coalesce(_detail, ''), 500));
END; $$;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _bucket text, _limit integer, _window_seconds integer, _subject uuid DEFAULT auth.uid()
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws timestamptz; _c integer;
BEGIN
  IF _subject IS NULL THEN RETURN false; END IF;
  _ws := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.rate_limits AS r (user_id, bucket, window_start, count)
  VALUES (_subject, _bucket, _ws, 1)
  ON CONFLICT (user_id, bucket, window_start) DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO _c;
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 days';
    DELETE FROM public.push_dedupe WHERE created_at < now() - interval '2 days';
    DELETE FROM public.security_events WHERE created_at < now() - interval '90 days';
  END IF;
  RETURN _c <= _limit;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(_bucket text, _limit integer, _window_seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.consume_rate_limit(_bucket, _limit, _window_seconds, auth.uid()) THEN
    PERFORM public.log_security_event('rate_limited', _bucket, auth.uid());
    RAISE EXCEPTION 'rate_limit_exceeded:%', _bucket USING ERRCODE = '54000';
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Narrow, client-callable wrapper used by the geocoding server function.
CREATE OR REPLACE FUNCTION public.rate_limit_geocode()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  ok := public.consume_rate_limit('geocode_min', 20, 60, auth.uid())
    AND public.consume_rate_limit('geocode_day', 500, 86400, auth.uid());
  IF NOT ok THEN PERFORM public.log_security_event('rate_limited', 'geocode', auth.uid()); END IF;
  RETURN ok;
END; $$;
GRANT EXECUTE ON FUNCTION public.rate_limit_geocode() TO authenticated;

-- 3. Write-path rate limits + validation ----------------------
CREATE OR REPLACE FUNCTION public.guard_messages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_rate_limit('msg_min', 20, 60);
  PERFORM public.enforce_rate_limit('msg_day', 500, 86400);
  IF NEW.image_path IS NOT NULL THEN
    PERFORM public.enforce_rate_limit('img_day', 50, 86400);
    IF NEW.image_path NOT LIKE NEW.family_circle_id::text || '/' || NEW.user_id::text || '/%' THEN
      PERFORM public.log_security_event('foreign_image_path', left(NEW.image_path, 200), auth.uid());
      RAISE EXCEPTION 'invalid_image_path';
    END IF;
  END IF;
  IF coalesce(char_length(NEW.body), 0) = 0 AND NEW.image_path IS NULL THEN
    RAISE EXCEPTION 'empty_message';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_messages ON public.messages;
CREATE TRIGGER trg_guard_messages BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_messages();

CREATE OR REPLACE FUNCTION public.guard_visits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a text;
BEGIN
  PERFORM public.enforce_rate_limit('visit_min', 15, 60);
  PERFORM public.enforce_rate_limit('visit_day', 50, 86400);
  IF NEW.local_day < current_date - 730 OR NEW.local_day > current_date + 2 THEN
    RAISE EXCEPTION 'invalid_local_day';
  END IF;
  IF NEW.visited_at < now() - interval '2 years' OR NEW.visited_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'invalid_visited_at';
  END IF;
  FOREACH a IN ARRAY coalesce(NEW.activities, '{}') LOOP
    IF char_length(a) > 40 THEN RAISE EXCEPTION 'invalid_activity'; END IF;
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_visits ON public.visits;
CREATE TRIGGER trg_guard_visits BEFORE INSERT ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.guard_visits();

CREATE OR REPLACE FUNCTION public.guard_planned_visits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a text;
BEGIN
  PERFORM public.enforce_rate_limit('planned_min', 15, 60);
  PERFORM public.enforce_rate_limit('planned_day', 50, 86400);
  IF NEW.planned_date < current_date - 365 OR NEW.planned_date > current_date + 730 THEN
    RAISE EXCEPTION 'invalid_planned_date';
  END IF;
  FOREACH a IN ARRAY coalesce(NEW.activities, '{}') LOOP
    IF char_length(a) > 40 THEN RAISE EXCEPTION 'invalid_activity'; END IF;
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_planned_visits ON public.planned_visits;
CREATE TRIGGER trg_guard_planned_visits BEFORE INSERT ON public.planned_visits
  FOR EACH ROW EXECUTE FUNCTION public.guard_planned_visits();

CREATE OR REPLACE FUNCTION public.guard_invitations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_rate_limit('invite_hour', 10, 3600);
  PERFORM public.enforce_rate_limit('invite_day', 30, 86400);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_invitations ON public.invitations;
CREATE TRIGGER trg_guard_invitations BEFORE INSERT ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.guard_invitations();

CREATE OR REPLACE FUNCTION public.guard_circles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_rate_limit('circle_hour', 5, 3600);
  PERFORM public.enforce_rate_limit('circle_day', 20, 86400);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_circles ON public.family_circles;
CREATE TRIGGER trg_guard_circles BEFORE INSERT ON public.family_circles
  FOR EACH ROW EXECUTE FUNCTION public.guard_circles();

CREATE OR REPLACE FUNCTION public.guard_persons()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_rate_limit('person_day', 50, 86400);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_persons ON public.persons;
CREATE TRIGGER trg_guard_persons BEFORE INSERT ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.guard_persons();

CREATE OR REPLACE FUNCTION public.guard_device_tokens()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_rate_limit('device_token_day', 50, 86400);
  IF char_length(NEW.token) > 400 OR char_length(NEW.locale) > 16 OR char_length(NEW.platform) > 16 THEN
    RAISE EXCEPTION 'invalid_device_token';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_device_tokens ON public.device_tokens;
CREATE TRIGGER trg_guard_device_tokens BEFORE INSERT ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.guard_device_tokens();

CREATE OR REPLACE FUNCTION public.trim_device_tokens()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.device_tokens d
  WHERE d.user_id = NEW.user_id
    AND d.token NOT IN (
      SELECT token FROM public.device_tokens
      WHERE user_id = NEW.user_id
      ORDER BY updated_at DESC
      LIMIT 5
    );
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_trim_device_tokens ON public.device_tokens;
CREATE TRIGGER trg_trim_device_tokens AFTER INSERT ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.trim_device_tokens();

-- 4. Column constraints (all satisfied by existing data) -------
ALTER TABLE public.messages
  ADD CONSTRAINT messages_body_len CHECK (char_length(body) <= 1000),
  ADD CONSTRAINT messages_image_path_len CHECK (image_path IS NULL OR char_length(image_path) <= 300),
  ADD CONSTRAINT messages_image_path_scope CHECK (
    image_path IS NULL
    OR image_path LIKE family_circle_id::text || '/' || user_id::text || '/%'
  );

ALTER TABLE public.visits
  ADD CONSTRAINT visits_source_valid CHECK (source IN ('manual', 'geofence', 'confirmed_planned_visit')),
  ADD CONSTRAINT visits_activities_len CHECK (coalesce(array_length(activities, 1), 0) <= 12),
  ADD CONSTRAINT visits_note_len CHECK (activity_note IS NULL OR char_length(activity_note) <= 500),
  ADD CONSTRAINT visits_client_token_len CHECK (client_token IS NULL OR char_length(client_token) <= 100);

ALTER TABLE public.planned_visits
  ADD CONSTRAINT planned_status_valid CHECK (status IN ('planned', 'cancelled', 'completed')),
  ADD CONSTRAINT planned_activities_len CHECK (coalesce(array_length(activities, 1), 0) <= 12),
  ADD CONSTRAINT planned_note_len CHECK (activity_note IS NULL OR char_length(activity_note) <= 500);

ALTER TABLE public.persons
  ADD CONSTRAINT persons_name_len CHECK (char_length(name) <= 100),
  ADD CONSTRAINT persons_address_len CHECK (address IS NULL OR char_length(address) <= 300),
  ADD CONSTRAINT persons_radius_range CHECK (geofence_radius BETWEEN 25 AND 5000);

ALTER TABLE public.family_circles
  ADD CONSTRAINT circles_name_len CHECK (char_length(name) <= 100),
  ADD CONSTRAINT circles_tz_len CHECK (char_length(timezone) <= 64);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_name_len CHECK (char_length(name) <= 100);

ALTER TABLE public.family_members
  ADD CONSTRAINT members_color_len CHECK (char_length(personal_color) <= 40);