-- Recurring (weekly) planned visits share a series id; the first row's id equals series_id.
ALTER TABLE public.planned_visits ADD COLUMN IF NOT EXISTS series_id uuid;

DROP TRIGGER IF EXISTS trg_push_planned ON public.planned_visits;
CREATE TRIGGER trg_push_planned AFTER INSERT ON public.planned_visits
  FOR EACH ROW WHEN (NEW.series_id IS NULL OR NEW.id = NEW.series_id)
  EXECUTE FUNCTION public.notify_push();

-- Events for the visited person: birthdays, doctor appointments, other.
-- The title is end-to-end encrypted on the device; the server only sees kind + date.
CREATE TABLE public.circle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.persons(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('birthday','doctor','other')),
  title text,
  event_date date NOT NULL,
  yearly boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  last_reminded_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_events TO authenticated;
GRANT ALL ON public.circle_events TO service_role;

ALTER TABLE public.circle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read events" ON public.circle_events FOR SELECT TO authenticated
  USING (public.is_circle_member(family_circle_id));
CREATE POLICY "members add events" ON public.circle_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_circle_member(family_circle_id));
CREATE POLICY "members update events" ON public.circle_events FOR UPDATE TO authenticated
  USING (public.is_circle_member(family_circle_id)) WITH CHECK (public.is_circle_member(family_circle_id));
CREATE POLICY "members delete events" ON public.circle_events FOR DELETE TO authenticated
  USING (public.is_circle_member(family_circle_id));

CREATE INDEX circle_events_circle_idx ON public.circle_events(family_circle_id);

CREATE OR REPLACE FUNCTION public.guard_circle_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enforce_rate_limit('events_min', 15, 60);
  PERFORM public.enforce_rate_limit('events_day', 100, 86400);
  IF char_length(coalesce(NEW.title, '')) > 2000 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF NEW.event_date < DATE '1900-01-01' OR NEW.event_date > current_date + 3650 THEN
    RAISE EXCEPTION 'invalid_event_date';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_guard_circle_events BEFORE INSERT ON public.circle_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_circle_events();

ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_events;

-- Same-day morning reminders (from 08:00 local circle time). Only the kind is sent, never the title.
CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _url text := 'https://project--5306c12d-e1ba-402f-8e1d-dba155762875-dev.lovable.app/api/public/push';
  _secret text := 'f449f586d969abb8b2e59983327c28ad531db365d1b4c477';
  r record;
  _local timestamp;
  _day date;
  _rid uuid;
  _ts text;
  _sig text;
BEGIN
  FOR r IN
    SELECT e.id, e.family_circle_id, e.kind, e.event_date, e.yearly, e.last_reminded_on, c.timezone
    FROM public.circle_events e JOIN public.family_circles c ON c.id = e.family_circle_id
  LOOP
    BEGIN
      _local := now() AT TIME ZONE r.timezone;
    EXCEPTION WHEN others THEN
      _local := now() AT TIME ZONE 'Europe/Stockholm';
    END;
    _day := _local::date;
    CONTINUE WHEN extract(hour FROM _local) < 8;
    CONTINUE WHEN r.last_reminded_on IS NOT DISTINCT FROM _day;
    CONTINUE WHEN NOT (
      (r.yearly AND to_char(r.event_date, 'MM-DD') = to_char(_day, 'MM-DD'))
      OR (NOT r.yearly AND r.event_date = _day)
    );

    UPDATE public.circle_events SET last_reminded_on = _day WHERE id = r.id;

    _rid := gen_random_uuid();
    _ts := (extract(epoch FROM now()))::bigint::text;
    _sig := encode(extensions.hmac(_ts || '.circle_events.' || _rid::text, _secret, 'sha256'), 'hex');
    PERFORM net.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', _secret,
        'x-push-ts', _ts,
        'x-push-id', _rid::text,
        'x-push-sig', _sig
      ),
      body := jsonb_build_object(
        'table', 'circle_events',
        'record', jsonb_build_object('id', _rid, 'family_circle_id', r.family_circle_id, 'kind', r.kind)
      )
    );
  END LOOP;
EXCEPTION WHEN others THEN
  INSERT INTO public.push_log(source_table, status, detail) VALUES ('circle_events', 'reminder_error', SQLERRM);
END; $$;

REVOKE ALL ON FUNCTION public.send_event_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('beenby-event-reminders', '5 * * * *', $$SELECT public.send_event_reminders();$$);