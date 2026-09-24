-- Allow the "medicine" event kind (pill icon in the visit overview).
ALTER TABLE public.circle_events
  DROP CONSTRAINT IF EXISTS circle_events_kind_check;

ALTER TABLE public.circle_events
  ADD CONSTRAINT circle_events_kind_check
  CHECK (kind IN ('birthday', 'doctor', 'medicine', 'other'));
