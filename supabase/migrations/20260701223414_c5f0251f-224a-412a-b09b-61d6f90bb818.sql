
-- Enums
CREATE TYPE public.workspace_type AS ENUM ('personal', 'business');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE public.account_type AS ENUM ('mpesa', 'cash', 'bank', 'sacco', 'custom');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  currency TEXT NOT NULL DEFAULT 'KES',
  active_workspace public.workspace_type NOT NULL DEFAULT 'personal',
  auto_lock_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default accounts + seed categories on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.accounts (user_id, name, type, is_default) VALUES
    (NEW.id, 'M-Pesa', 'mpesa', true),
    (NEW.id, 'Cash', 'cash', false);

  INSERT INTO public.categories (user_id, name, icon, color, workspace) VALUES
    (NEW.id, 'Food', 'utensils', '#5FA98A', 'personal'),
    (NEW.id, 'Transport', 'car', '#8B8D97', 'personal'),
    (NEW.id, 'Utilities', 'zap', '#C9A24B', 'personal'),
    (NEW.id, 'Rent', 'home', '#C97B6C', 'personal'),
    (NEW.id, 'Entertainment', 'film', '#8B8D97', 'personal'),
    (NEW.id, 'Salary', 'briefcase', '#5FA98A', 'personal'),
    (NEW.id, 'Revenue', 'trending-up', '#5FA98A', 'business'),
    (NEW.id, 'Equipment', 'package', '#8B8D97', 'business'),
    (NEW.id, 'Marketing', 'megaphone', '#C9A24B', 'business'),
    (NEW.id, 'Operations', 'settings', '#8B8D97', 'business');
  RETURN NEW;
END; $$;

-- ACCOUNTS
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.account_type NOT NULL DEFAULT 'custom',
  is_default BOOLEAN NOT NULL DEFAULT false,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_accounts_user ON public.accounts(user_id);

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'circle',
  color TEXT DEFAULT '#8B8D97',
  workspace public.workspace_type NOT NULL DEFAULT 'personal',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_categories_user ON public.categories(user_id);
CREATE INDEX idx_categories_workspace ON public.categories(user_id, workspace);

-- TAGS
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tags" ON public.tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  type public.transaction_type NOT NULL DEFAULT 'expense',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  workspace public.workspace_type NOT NULL DEFAULT 'personal',
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  receipt_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_tx_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_tx_workspace ON public.transactions(user_id, workspace, deleted_at);
CREATE INDEX idx_tx_category ON public.transactions(category_id);

-- CATEGORY LEARNINGS
CREATE TABLE public.category_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  workspace public.workspace_type NOT NULL DEFAULT 'personal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, term, workspace)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_learnings TO authenticated;
GRANT ALL ON public.category_learnings TO service_role;
ALTER TABLE public.category_learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learnings" ON public.category_learnings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_learn_lookup ON public.category_learnings(user_id, workspace, term);

-- SECURITY LOG
CREATE TABLE public.security_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  device_info TEXT,
  ip TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_log TO authenticated;
GRANT ALL ON public.security_log TO service_role;
ALTER TABLE public.security_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own log read" ON public.security_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own log write" ON public.security_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_seclog_user ON public.security_log(user_id, created_at DESC);

-- Signup trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
