
-- Justify remaining authenticated EXECUTE grants (linter warns; intentional).
COMMENT ON FUNCTION public.current_user_email() IS
  'SECURITY DEFINER: reads auth.users to return the caller''s own email. Callable by authenticated because it is invoked from RLS policies and is_owner(). Returns only the caller''s own email (WHERE id = auth.uid()), so it cannot leak other users'' data.';

COMMENT ON FUNCTION public.is_owner() IS
  'SECURITY DEFINER: checks whether the caller is an active owner on the approved_emails allowlist. Callable by authenticated because it is used inside RLS policies for owner-gated tables. Returns only a boolean about the caller; discloses nothing else.';

COMMENT ON FUNCTION public.savings_record_entry(uuid, savings_entry_type, numeric, date, text) IS
  'SECURITY DEFINER: atomic dual-write of savings_ledger + transactions. Callable by authenticated only (anon revoked). All writes are scoped to auth.uid(); the function raises if the target account is not owned by the caller, so cross-user access is impossible.';
