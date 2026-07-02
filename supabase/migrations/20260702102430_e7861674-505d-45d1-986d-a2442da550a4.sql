
REVOKE ALL ON FUNCTION public.run_recurring_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_recurring_rules() TO service_role;
