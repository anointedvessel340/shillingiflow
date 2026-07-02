
-- ============ ENUMS ============
CREATE TYPE public.budget_period AS ENUM ('weekly','monthly','custom');
CREATE TYPE public.goal_status AS ENUM ('active','paused','archived','completed');
CREATE TYPE public.debt_direction AS ENUM ('owed_to_me','i_owe');
CREATE TYPE public.debt_status AS ENUM ('open','settled','written_off');
CREATE TYPE public.client_status AS ENUM ('lead','prospect','active','vip','inactive');
CREATE TYPE public.project_status AS ENUM ('quoted','booked','in_progress','delivered','paid','cancelled');
CREATE TYPE public.invoice_status AS ENUM ('draft','unpaid','partial','paid','overdue','cancelled');
CREATE TYPE public.equipment_status AS ENUM ('available','assigned','in_repair','retired');
CREATE TYPE public.equipment_condition AS ENUM ('new','excellent','good','fair','poor');
CREATE TYPE public.maintenance_type AS ENUM ('repair','routine','inspection');
CREATE TYPE public.recurrence_freq AS ENUM ('daily','weekly','biweekly','monthly','quarterly','yearly');
CREATE TYPE public.recurring_status AS ENUM ('active','paused');

-- ============ BUDGETS ============
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  workspace workspace_type NOT NULL DEFAULT 'personal',
  amount numeric NOT NULL CHECK (amount >= 0),
  period_type budget_period NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER budgets_upd BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GOALS ============
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  workspace workspace_type NOT NULL DEFAULT 'personal',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  color text DEFAULT '#C9A24B',
  icon text DEFAULT 'target',
  status goal_status NOT NULL DEFAULT 'active',
  recurring_amount numeric,
  recurring_freq recurrence_freq,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER goals_upd BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_contributions TO authenticated;
GRANT ALL ON public.goal_contributions TO service_role;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contributions" ON public.goal_contributions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sync goal current_amount on contribution changes
CREATE OR REPLACE FUNCTION public.sync_goal_current() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE gid uuid;
BEGIN
  gid := COALESCE(NEW.goal_id, OLD.goal_id);
  UPDATE public.goals g SET current_amount = COALESCE((SELECT SUM(amount) FROM public.goal_contributions WHERE goal_id = gid), 0),
    status = CASE WHEN COALESCE((SELECT SUM(amount) FROM public.goal_contributions WHERE goal_id = gid), 0) >= g.target_amount AND g.status = 'active' THEN 'completed'::goal_status ELSE g.status END
  WHERE g.id = gid;
  RETURN NULL;
END $$;
CREATE TRIGGER goal_contrib_sync AFTER INSERT OR UPDATE OR DELETE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.sync_goal_current();

-- ============ DEBTS ============
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  person_or_institution text NOT NULL,
  direction debt_direction NOT NULL,
  original_amount numeric NOT NULL CHECK (original_amount > 0),
  current_balance numeric NOT NULL,
  interest_rate numeric DEFAULT 0,
  due_date date,
  workspace workspace_type NOT NULL DEFAULT 'personal',
  status debt_status NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debts" ON public.debts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER debts_upd BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  remaining_balance_after numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_payments TO authenticated;
GRANT ALL ON public.debt_payments TO service_role;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debt payments" ON public.debt_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_debt_balance() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE did uuid; paid numeric; orig numeric;
BEGIN
  did := COALESCE(NEW.debt_id, OLD.debt_id);
  SELECT COALESCE(SUM(amount),0) INTO paid FROM public.debt_payments WHERE debt_id = did;
  SELECT original_amount INTO orig FROM public.debts WHERE id = did;
  UPDATE public.debts SET current_balance = GREATEST(orig - paid, 0),
    status = CASE WHEN (orig - paid) <= 0 THEN 'settled'::debt_status ELSE 'open'::debt_status END
  WHERE id = did;
  RETURN NULL;
END $$;
CREATE TRIGGER debt_payment_sync AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_debt_balance();

-- ============ CLIENTS / PROJECTS / INVOICES ============
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  business_name text,
  phone text,
  email text,
  location text,
  status client_status NOT NULL DEFAULT 'lead',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clients" ON public.clients FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER clients_upd BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  category text,
  description text,
  venue text,
  start_date date,
  end_date date,
  status project_status NOT NULL DEFAULT 'quoted',
  estimated_revenue numeric DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER projects_upd BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER invoices_upd BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoice items" ON public.invoice_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoice payments" ON public.invoice_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add project/client links on transactions
ALTER TABLE public.transactions
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN invoice_payment_id uuid REFERENCES public.invoice_payments(id) ON DELETE SET NULL,
  ADD COLUMN recurring_rule_id uuid;

-- Sync invoice amount_paid + status; also create linked income transaction on payment
CREATE OR REPLACE FUNCTION public.sync_invoice_on_payment() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE iid uuid; paid numeric; tot numeric; new_status invoice_status; inv record;
BEGIN
  iid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO paid FROM public.invoice_payments WHERE invoice_id = iid;
  SELECT * INTO inv FROM public.invoices WHERE id = iid;
  tot := inv.total;
  new_status := CASE
    WHEN paid <= 0 THEN 'unpaid'::invoice_status
    WHEN paid >= tot AND tot > 0 THEN 'paid'::invoice_status
    ELSE 'partial'::invoice_status
  END;
  UPDATE public.invoices SET amount_paid = paid, status = new_status WHERE id = iid;

  -- On INSERT create a linked income transaction (business workspace)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions (user_id, amount, type, account_id, workspace, description, date, client_id, project_id, invoice_payment_id)
    VALUES (NEW.user_id, NEW.amount, 'income', NEW.account_id, 'business',
            'Invoice ' || COALESCE(inv.invoice_number, ''), NEW.date, inv.client_id, inv.project_id, NEW.id);
  END IF;
  -- On DELETE, remove any linked transaction
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE invoice_payment_id = OLD.id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER invoice_payment_sync AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_on_payment();

-- ============ EQUIPMENT ============
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  subcategory text,
  brand text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_price numeric DEFAULT 0,
  current_value numeric DEFAULT 0,
  depreciation_method text NOT NULL DEFAULT 'straight_line',
  useful_life_years integer DEFAULT 5,
  condition equipment_condition NOT NULL DEFAULT 'good',
  status equipment_status NOT NULL DEFAULT 'available',
  storage_location text,
  workspace workspace_type NOT NULL DEFAULT 'business',
  assigned_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  warranty_end_date date,
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own equipment" ON public.equipment FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER equipment_upd BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.equipment_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type maintenance_type NOT NULL DEFAULT 'routine',
  cost numeric DEFAULT 0,
  technician_or_provider text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_maintenance TO authenticated;
GRANT ALL ON public.equipment_maintenance TO service_role;
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own maintenance" ON public.equipment_maintenance FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ RECURRING RULES ============
CREATE TABLE public.recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace workspace_type NOT NULL DEFAULT 'personal',
  type transaction_type NOT NULL DEFAULT 'expense',
  amount numeric NOT NULL CHECK (amount > 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  frequency recurrence_freq NOT NULL,
  next_occurrence_date date NOT NULL,
  end_date date,
  status recurring_status NOT NULL DEFAULT 'active',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_rules TO authenticated;
GRANT ALL ON public.recurring_rules TO service_role;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring" ON public.recurring_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER recurring_upd BEFORE UPDATE ON public.recurring_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurring_rule_id_fkey
  FOREIGN KEY (recurring_rule_id) REFERENCES public.recurring_rules(id) ON DELETE SET NULL;

-- Function that materializes due recurring rules (idempotent per next_occurrence_date)
CREATE OR REPLACE FUNCTION public.run_recurring_rules() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; created integer := 0; nxt date;
BEGIN
  FOR r IN SELECT * FROM public.recurring_rules
           WHERE status = 'active' AND next_occurrence_date <= CURRENT_DATE
             AND (end_date IS NULL OR next_occurrence_date <= end_date)
  LOOP
    INSERT INTO public.transactions (user_id, amount, type, category_id, account_id, workspace, description, date, recurring_rule_id)
    VALUES (r.user_id, r.amount, r.type, r.category_id, r.account_id, r.workspace,
            COALESCE(r.description,'Recurring'), r.next_occurrence_date, r.id);
    nxt := CASE r.frequency
      WHEN 'daily' THEN r.next_occurrence_date + INTERVAL '1 day'
      WHEN 'weekly' THEN r.next_occurrence_date + INTERVAL '7 days'
      WHEN 'biweekly' THEN r.next_occurrence_date + INTERVAL '14 days'
      WHEN 'monthly' THEN r.next_occurrence_date + INTERVAL '1 month'
      WHEN 'quarterly' THEN r.next_occurrence_date + INTERVAL '3 months'
      WHEN 'yearly' THEN r.next_occurrence_date + INTERVAL '1 year'
    END::date;
    UPDATE public.recurring_rules SET next_occurrence_date = nxt WHERE id = r.id;
    created := created + 1;
  END LOOP;
  RETURN created;
END $$;
GRANT EXECUTE ON FUNCTION public.run_recurring_rules() TO authenticated, service_role;

-- Schedule daily via pg_cron if available (ignore if not)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.schedule('run-recurring-rules-daily', '5 0 * * *', $q$SELECT public.run_recurring_rules();$q$);
  ELSE
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      PERFORM cron.schedule('run-recurring-rules-daily', '5 0 * * *', $q$SELECT public.run_recurring_rules();$q$);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not available; recurring rules must be triggered manually.';
    END;
  END IF;
END $$;

-- Search index helper (trigram) for global search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS transactions_desc_trgm ON public.transactions USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS categories_name_trgm ON public.categories USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS goals_name_trgm ON public.goals USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS debts_name_trgm ON public.debts USING gin (person_or_institution gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clients_name_trgm ON public.clients USING gin (name gin_trgm_ops);
