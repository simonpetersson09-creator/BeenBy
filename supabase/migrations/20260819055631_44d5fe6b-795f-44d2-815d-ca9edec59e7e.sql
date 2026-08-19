ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS activities text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS activity_note text;

ALTER TABLE public.planned_visits
  ADD COLUMN IF NOT EXISTS activities text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS activity_note text;

CREATE INDEX IF NOT EXISTS visits_activities_idx ON public.visits USING gin (activities);
CREATE INDEX IF NOT EXISTS planned_visits_activities_idx ON public.planned_visits USING gin (activities);