-- ─────────────────────────────────────────────
-- 1. premium_entitlements: server-verified Apple data
-- ─────────────────────────────────────────────
ALTER TABLE public.premium_entitlements
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- One Apple subscription can only ever belong to one BeenBy account.
CREATE UNIQUE INDEX IF NOT EXISTS premium_entitlements_original_tx_key
  ON public.premium_entitlements(original_transaction_id)
  WHERE original_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.has_app_access(_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT p.trial_started_at IS NOT NULL
            AND (p.trial_started_at + interval '30 days') > now()
     FROM public.profiles p WHERE p.id = _user), false)
  OR COALESCE(
    (SELECT e.is_active
            AND e.revoked_at IS NULL
            AND (e.expires_at IS NULL OR e.expires_at > now())
     FROM public.premium_entitlements e WHERE e.user_id = _user), false);
$function$;

-- ─────────────────────────────────────────────
-- 2. App Store Server Notifications log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apple_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_uuid text UNIQUE,
  notification_type text,
  subtype text,
  original_transaction_id text,
  status text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.apple_notifications TO service_role;
ALTER TABLE public.apple_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no client access to apple_notifications" ON public.apple_notifications;
CREATE POLICY "no client access to apple_notifications"
  ON public.apple_notifications FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────
-- 3. Trial anchors (device-bound, survives reinstall via iOS Keychain)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trial_anchors (
  anchor_hash text PRIMARY KEY,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.trial_anchors TO service_role;
ALTER TABLE public.trial_anchors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no client access to trial_anchors" ON public.trial_anchors;
CREATE POLICY "no client access to trial_anchors"
  ON public.trial_anchors FOR ALL TO authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_anchor_hash text;

/*
  Called from the iOS app with a random UUID stored in the Keychain. The
  Keychain entry survives app deletion, so "start over", sign-out, a new
  anonymous user, cleared web storage and a reinstall all present the SAME
  anchor. The earliest trial start ever seen for that anchor wins, which means
  the free period cannot be restarted from the app.

  The anchor is only ever stored as a SHA-256 hash — never the raw value.
*/
CREATE OR REPLACE FUNCTION public.claim_trial_anchor(_anchor text)
RETURNS TABLE(trial_started_at timestamptz, trial_ends_at timestamptz,
              trial_days_left integer, is_trial_active boolean, server_now timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  uid uuid := auth.uid();
  h text;
  anchor_start timestamptz;
  profile_start timestamptz;
  effective timestamptz;
BEGIN
  IF uid IS NULL OR _anchor IS NULL OR length(trim(_anchor)) < 8 THEN
    RETURN QUERY SELECT * FROM public.get_trial_status();
    RETURN;
  END IF;

  h := encode(extensions.digest(trim(_anchor), 'sha256'), 'hex');

  SELECT p.trial_started_at INTO profile_start FROM public.profiles p WHERE p.id = uid;

  INSERT INTO public.trial_anchors(anchor_hash, trial_started_at)
  VALUES (h, COALESCE(profile_start, now()))
  ON CONFLICT (anchor_hash) DO UPDATE SET last_seen_at = now()
  RETURNING public.trial_anchors.trial_started_at INTO anchor_start;

  IF anchor_start IS NULL THEN
    SELECT a.trial_started_at INTO anchor_start FROM public.trial_anchors a WHERE a.anchor_hash = h;
  END IF;

  -- The earliest start ever seen for this device or this profile wins.
  effective := LEAST(COALESCE(anchor_start, profile_start), COALESCE(profile_start, anchor_start));

  UPDATE public.trial_anchors SET trial_started_at = effective, last_seen_at = now()
  WHERE anchor_hash = h AND trial_started_at > effective;

  UPDATE public.profiles
  SET trial_started_at = effective, trial_anchor_hash = h
  WHERE id = uid AND (trial_started_at IS DISTINCT FROM effective OR trial_anchor_hash IS DISTINCT FROM h);

  RETURN QUERY SELECT * FROM public.get_trial_status();
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_trial_anchor(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_trial_anchor(text) TO authenticated;