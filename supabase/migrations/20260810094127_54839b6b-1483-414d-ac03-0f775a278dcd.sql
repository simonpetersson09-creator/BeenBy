CREATE TABLE public.premium_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  platform text,
  product_id text,
  expires_at timestamp with time zone,
  original_transaction_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.premium_entitlements TO authenticated;
GRANT ALL ON public.premium_entitlements TO service_role;

ALTER TABLE public.premium_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own premium" ON public.premium_entitlements
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_premium_entitlements_updated_at
BEFORE UPDATE ON public.premium_entitlements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();