ALTER FUNCTION public.savings_record_entry(uuid, public.savings_entry_type, numeric, date, text) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.savings_record_entry(uuid, public.savings_entry_type, numeric, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.email_is_approved(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.run_recurring_rules() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.savings_ledger_cascade_delete() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.savings_record_entry(uuid, public.savings_entry_type, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;