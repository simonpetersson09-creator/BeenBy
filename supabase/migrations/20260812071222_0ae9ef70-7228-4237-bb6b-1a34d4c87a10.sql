-- 1) Lock down trial_started_at: column-level privileges
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Belt and braces: a trigger that re-asserts trial_started_at for non-privileged roles
CREATE OR REPLACE FUNCTION public.protect_trial_started_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at THEN
    NEW.trial_started_at := OLD.trial_started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_trial_started_at ON public.profiles;
CREATE TRIGGER protect_trial_started_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_trial_started_at();

-- 2) Server-side access check (trial OR premium)
CREATE OR REPLACE FUNCTION public.has_app_access(_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.trial_started_at IS NOT NULL
            AND (p.trial_started_at + interval '30 days') > now()
     FROM public.profiles p WHERE p.id = _user), false)
  OR COALESCE(
    (SELECT e.is_active AND (e.expires_at IS NULL OR e.expires_at > now())
     FROM public.premium_entitlements e WHERE e.user_id = _user), false);
$$;

REVOKE ALL ON FUNCTION public.has_app_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_app_access(uuid) TO authenticated, service_role;

-- 3) Gate writes on paid features
DROP POLICY IF EXISTS "insert own visits" ON public.visits;
CREATE POLICY "insert own visits" ON public.visits
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND is_circle_member(family_circle_id) AND has_app_access());

DROP POLICY IF EXISTS "insert own planned" ON public.planned_visits;
CREATE POLICY "insert own planned" ON public.planned_visits
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND is_circle_member(family_circle_id) AND has_app_access());

DROP POLICY IF EXISTS "update own planned" ON public.planned_visits;
CREATE POLICY "update own planned" ON public.planned_visits
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND has_app_access());

DROP POLICY IF EXISTS "insert own messages" ON public.messages;
CREATE POLICY "insert own messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND is_circle_member(family_circle_id) AND has_app_access());

-- 4) Geofence tracking requires access
DROP POLICY IF EXISTS "update own membership" ON public.family_members;
CREATE POLICY "update own membership" ON public.family_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND (geofence_enabled = false OR has_app_access()));