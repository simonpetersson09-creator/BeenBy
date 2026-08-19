REVOKE ALL ON public.device_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

REVOKE ALL ON FUNCTION public.notify_push() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_push() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_push() TO postgres;