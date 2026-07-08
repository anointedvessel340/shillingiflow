
-- ============ Access control enums ============
DO $$ BEGIN
  CREATE TYPE public.access_role AS ENUM ('owner', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.access_status AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ approved_emails ============
CREATE TABLE public.approved_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role public.access_role NOT NULL DEFAULT 'admin',
  status public.access_status NOT NULL DEFAULT 'active',
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_emails_lowercase CHECK (email = lower(email))
);

GRANT SELECT, INSERT, UPDATE ON public.approved_emails TO authenticated;
GRANT ALL ON public.approved_emails TO service_role;

ALTER TABLE public.approved_emails ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.approved_emails
    WHERE email = public.current_user_email()
      AND role = 'owner'
      AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.email_is_approved(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.approved_emails
    WHERE email = lower(_email) AND status = 'active'
  )
$$;

-- RLS: owner sees all rows, users see only their own row
CREATE POLICY "read own or all if owner" ON public.approved_emails
  FOR SELECT TO authenticated
  USING (public.is_owner() OR email = public.current_user_email());

-- Writes: owner only, AND require aal2 (2FA) at the DB level
CREATE POLICY "owner insert with 2fa" ON public.approved_emails
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner()
    AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );

CREATE POLICY "owner update with 2fa" ON public.approved_emails
  FOR UPDATE TO authenticated
  USING (public.is_owner() AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  WITH CHECK (public.is_owner() AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');

CREATE TRIGGER approved_emails_updated_at
  BEFORE UPDATE ON public.approved_emails
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the sole owner
INSERT INTO public.approved_emails (email, role, status)
VALUES ('kelvinspacepersonal@gmail.com', 'owner', 'active')
ON CONFLICT (email) DO UPDATE SET role = 'owner', status = 'active';

-- ============ login_attempts ============
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL,
  reason text,
  ip text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_time_idx
  ON public.login_attempts (email, created_at DESC);

GRANT SELECT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads login attempts" ON public.login_attempts
  FOR SELECT TO authenticated
  USING (public.is_owner());
-- No INSERT policy on purpose: only service_role writes (via server functions).
