REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trial_on_membership() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trial_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_family_code() FROM PUBLIC, anon;