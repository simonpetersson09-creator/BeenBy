REVOKE EXECUTE ON FUNCTION public.claim_trial_anchor(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO service_role;
REVOKE EXECUTE ON FUNCTION public.leave_family_circle(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_family_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_circle_access(uuid) FROM anon, authenticated;