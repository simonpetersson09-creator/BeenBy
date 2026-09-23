CREATE TABLE IF NOT EXISTS public.member_public_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_jwk jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.member_public_keys TO authenticated;
GRANT ALL ON public.member_public_keys TO service_role;

ALTER TABLE public.member_public_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own key write" ON public.member_public_keys;
CREATE POLICY "own key write" ON public.member_public_keys
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own key update" ON public.member_public_keys;
CREATE POLICY "own key update" ON public.member_public_keys
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "read keys of family members" ON public.member_public_keys;
CREATE POLICY "read keys of family members" ON public.member_public_keys
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.family_members me
      JOIN public.family_members other ON other.family_circle_id = me.family_circle_id
      WHERE me.user_id = auth.uid() AND other.user_id = member_public_keys.user_id
    )
  );

CREATE TABLE IF NOT EXISTS public.circle_key_wraps (
  family_circle_id uuid NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_public_jwk jsonb NOT NULL,
  wrapped_key text NOT NULL,
  iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_circle_id, recipient_id)
);

GRANT SELECT, INSERT, DELETE ON public.circle_key_wraps TO authenticated;
GRANT ALL ON public.circle_key_wraps TO service_role;

ALTER TABLE public.circle_key_wraps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read wraps" ON public.circle_key_wraps;
CREATE POLICY "members read wraps" ON public.circle_key_wraps
  FOR SELECT TO authenticated USING (public.is_circle_member(family_circle_id));

DROP POLICY IF EXISTS "members share the key" ON public.circle_key_wraps;
CREATE POLICY "members share the key" ON public.circle_key_wraps
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND public.is_circle_member(family_circle_id)
  );

DROP POLICY IF EXISTS "own wrap delete" ON public.circle_key_wraps;
CREATE POLICY "own wrap delete" ON public.circle_key_wraps
  FOR DELETE TO authenticated USING (recipient_id = auth.uid());