CREATE OR REPLACE FUNCTION public.delete_my_account_for(_user uuid)
RETURNS TABLE(image_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _user IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT m.image_path FROM public.messages m
    WHERE m.user_id = _user AND m.image_path IS NOT NULL;

  DELETE FROM public.device_tokens WHERE user_id = _user;
  DELETE FROM public.messages WHERE user_id = _user;
  DELETE FROM public.planned_visits WHERE user_id = _user;
  DELETE FROM public.visits WHERE user_id = _user;
  DELETE FROM public.family_members WHERE user_id = _user;
  DELETE FROM public.premium_entitlements WHERE user_id = _user;
  DELETE FROM public.profiles WHERE id = _user;
  PERFORM public.log_security_event('account_deleted', NULL, _user);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_my_account_for(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account_for(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.delete_my_account();