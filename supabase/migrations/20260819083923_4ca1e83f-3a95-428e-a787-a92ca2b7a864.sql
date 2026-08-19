REVOKE ALL ON FUNCTION public.rate_limit_geocode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_limit_geocode() TO authenticated;
REVOKE ALL ON FUNCTION public.is_circle_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_circle_creator(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_app_access(uuid) FROM PUBLIC, anon, authenticated;