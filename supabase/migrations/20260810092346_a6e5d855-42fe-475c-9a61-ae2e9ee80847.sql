
REVOKE EXECUTE ON FUNCTION public.preview_invite(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_circle(text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.circle_member_names(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_circle_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_circle_creator(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.preview_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_circle(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.circle_member_names(uuid) TO authenticated;
