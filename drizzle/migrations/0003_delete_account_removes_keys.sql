CREATE OR REPLACE FUNCTION public.delete_my_account_for(_user uuid)
RETURNS TABLE(image_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF _user IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT m.image_path FROM public.messages m
    WHERE m.user_id = _user AND m.image_path IS NOT NULL;

  DELETE FROM public.device_tokens WHERE user_id = _user;
  DELETE FROM public.messages WHERE user_id = _user;
  DELETE FROM public.planned_visits WHERE user_id = _user;
  DELETE FROM public.visits WHERE user_id = _user;
  DELETE FROM public.circle_key_wraps WHERE recipient_id = _user OR sender_id = _user;
  DELETE FROM public.member_public_keys WHERE user_id = _user;
  DELETE FROM public.family_members WHERE user_id = _user;
  DELETE FROM public.premium_entitlements WHERE user_id = _user;
  DELETE FROM public.profiles WHERE id = _user;
  PERFORM public.log_security_event('account_deleted', NULL, _user);
END;
$fn$;