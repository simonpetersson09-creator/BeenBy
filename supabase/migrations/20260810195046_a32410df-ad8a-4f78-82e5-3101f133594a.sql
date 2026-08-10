ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.start_trial_on_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.user_id, '')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles
  SET trial_started_at = now()
  WHERE id = NEW.user_id AND trial_started_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS start_trial_on_membership ON public.family_members;
CREATE TRIGGER start_trial_on_membership
AFTER INSERT ON public.family_members
FOR EACH ROW EXECUTE FUNCTION public.start_trial_on_membership();

UPDATE public.profiles p
SET trial_started_at = sub.first_joined
FROM (
  SELECT user_id, min(joined_at) AS first_joined
  FROM public.family_members
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id AND p.trial_started_at IS NULL;