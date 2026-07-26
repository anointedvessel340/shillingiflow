
-- Lock down EXECUTE on all SECURITY DEFINER functions to the minimum required audience.

-- current_user_email: needed by RLS/is_owner; only signed-in users need it directly.
REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;

-- is_owner: used inside RLS policies and by signed-in admin UI.
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- email_is_approved: retained for pre-auth allowlist checks. Returns only a
-- boolean; the actual sign-in decision is enforced separately in the server
-- function auth flow, so this cannot be used to bypass authentication. It
-- still allows probing whether an email is on the allowlist, so callers are
-- restricted to server-side roles only (never anon/authenticated from the
-- browser). If a truly pre-auth caller ever needs it, grant explicitly here.
REVOKE ALL ON FUNCTION public.email_is_approved(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_is_approved(text) TO service_role;

-- handle_new_user: trigger function on auth.users; must not be user-callable.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- run_recurring_rules: scheduled job; only privileged roles may invoke.
REVOKE ALL ON FUNCTION public.run_recurring_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_recurring_rules() TO service_role;

-- savings_ledger_cascade_delete: trigger function; not user-callable.
REVOKE ALL ON FUNCTION public.savings_ledger_cascade_delete() FROM PUBLIC, anon, authenticated;

-- savings_record_entry: user-facing RPC; requires an authenticated session
-- (uses auth.uid()). Explicitly deny anon.
REVOKE ALL ON FUNCTION public.savings_record_entry(uuid, savings_entry_type, numeric, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.savings_record_entry(uuid, savings_entry_type, numeric, date, text) TO authenticated;
