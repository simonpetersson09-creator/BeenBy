-- Start the 30-day trial when a user joins/creates a family circle
DROP TRIGGER IF EXISTS trg_start_trial_on_membership ON public.family_members;
CREATE TRIGGER trg_start_trial_on_membership
AFTER INSERT ON public.family_members
FOR EACH ROW EXECUTE FUNCTION public.start_trial_on_membership();

-- Protect the trial clock from client-side tampering
CREATE OR REPLACE FUNCTION public.protect_trial_started_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at THEN
    -- only allow setting it once, from NULL (done by start_trial_on_membership),
    -- or by privileged backend roles
    IF OLD.trial_started_at IS NOT NULL AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'trial_started_at cannot be modified';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_trial_started_at ON public.profiles;
CREATE TRIGGER trg_protect_trial_started_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_trial_started_at();

REVOKE EXECUTE ON FUNCTION public.protect_trial_started_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trial_on_membership() FROM PUBLIC, anon, authenticated;

-- Backfill anyone who is already a member but never got a trial start
UPDATE public.profiles p
SET trial_started_at = now()
WHERE p.trial_started_at IS NULL
  AND EXISTS (SELECT 1 FROM public.family_members m WHERE m.user_id = p.id);