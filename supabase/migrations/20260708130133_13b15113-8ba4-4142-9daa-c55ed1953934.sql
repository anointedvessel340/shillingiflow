
REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.email_is_approved(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_is_approved(text) TO service_role;
