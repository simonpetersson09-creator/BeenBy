CREATE OR REPLACE FUNCTION public.get_trial_status()
RETURNS TABLE(
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_days_left integer,
  is_trial_active boolean,
  server_now timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.trial_started_at,
    (p.trial_started_at + interval '30 days') AS trial_ends_at,
    GREATEST(
      0,
      CEIL(
        EXTRACT(EPOCH FROM ((p.trial_started_at + interval '30 days') - now())) / 86400.0
      )
    )::int AS trial_days_left,
    (p.trial_started_at IS NOT NULL
      AND (p.trial_started_at + interval '30 days') > now()) AS is_trial_active,
    now() AS server_now
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_trial_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trial_status() TO authenticated;