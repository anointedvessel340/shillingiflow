
-- Extend transaction type enum
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'savings_deposit';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'savings_withdrawal';

-- Kind enums
DO $$ BEGIN
  CREATE TYPE public.savings_account_kind AS ENUM ('savings', 'investment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.savings_account_status AS ENUM ('active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.savings_compounding AS ENUM ('monthly', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.savings_entry_type AS ENUM ('deposit', 'withdrawal', 'manual_valuation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- savings_accounts
CREATE TABLE IF NOT EXISTS public.savings_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  held_at text,
  account_kind public.savings_account_kind NOT NULL DEFAULT 'savings',
  workspace public.workspace_type NOT NULL DEFAULT 'personal',
  interest_rate numeric,
  compounding_frequency public.savings_compounding NOT NULL DEFAULT 'none',
  opened_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.savings_account_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_accounts TO authenticated;
GRANT ALL ON public.savings_accounts TO service_role;
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own savings accounts" ON public.savings_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER savings_accounts_updated BEFORE UPDATE ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- savings_ledger
CREATE TABLE IF NOT EXISTS public.savings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.savings_accounts(id) ON DELETE CASCADE,
  entry_type public.savings_entry_type NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  linked_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS savings_ledger_account_idx ON public.savings_ledger(account_id, date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_ledger TO authenticated;
GRANT ALL ON public.savings_ledger TO service_role;
ALTER TABLE public.savings_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own savings ledger" ON public.savings_ledger FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Atomic dual-write RPC: records deposit/withdrawal and creates linked transaction
CREATE OR REPLACE FUNCTION public.savings_record_entry(
  _account_id uuid,
  _entry_type public.savings_entry_type,
  _amount numeric,
  _date date,
  _notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct record;
  tx_id uuid;
  ledger_id uuid;
  tx_type public.transaction_type;
  label text;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO acct FROM public.savings_accounts WHERE id = _account_id AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  IF _entry_type = 'manual_valuation' THEN
    INSERT INTO public.savings_ledger (user_id, account_id, entry_type, amount, date, notes)
    VALUES (uid, _account_id, _entry_type, _amount, _date, _notes)
    RETURNING id INTO ledger_id;
    RETURN ledger_id;
  END IF;

  IF _entry_type = 'deposit' THEN
    tx_type := 'savings_deposit';
    label := CASE WHEN acct.account_kind = 'investment' THEN 'Investment deposit — ' ELSE 'Savings deposit — ' END || acct.name;
  ELSE
    tx_type := 'savings_withdrawal';
    label := CASE WHEN acct.account_kind = 'investment' THEN 'Investment withdrawal — ' ELSE 'Savings withdrawal — ' END || acct.name;
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, workspace, description, date)
  VALUES (uid, _amount, tx_type, acct.workspace, label, _date)
  RETURNING id INTO tx_id;

  INSERT INTO public.savings_ledger (user_id, account_id, entry_type, amount, date, notes, linked_transaction_id)
  VALUES (uid, _account_id, _entry_type, _amount, _date, _notes, tx_id)
  RETURNING id INTO ledger_id;

  RETURN ledger_id;
END $$;

REVOKE ALL ON FUNCTION public.savings_record_entry(uuid, public.savings_entry_type, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.savings_record_entry(uuid, public.savings_entry_type, numeric, date, text) TO authenticated;

-- Keep ledger and transaction linked on delete
CREATE OR REPLACE FUNCTION public.savings_ledger_cascade_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.linked_transaction_id IS NOT NULL THEN
    DELETE FROM public.transactions WHERE id = OLD.linked_transaction_id;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS savings_ledger_delete_trg ON public.savings_ledger;
CREATE TRIGGER savings_ledger_delete_trg BEFORE DELETE ON public.savings_ledger
  FOR EACH ROW EXECUTE FUNCTION public.savings_ledger_cascade_delete();
