-- 1) Backdating: keep `date` as the authoritative transaction date, add an optional time-of-day
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS occurred_time time without time zone;

COMMENT ON COLUMN public.transactions.occurred_time IS 'Optional time-of-day the money moved. Bucketing/reporting always uses transactions.date, never created_at.';

-- 2) Passkeys / biometric credentials
CREATE TABLE IF NOT EXISTS public.passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_label text NOT NULL DEFAULT 'Unknown device',
  user_agent text,
  backed_up boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.passkeys TO authenticated;
GRANT ALL ON public.passkeys TO service_role;

ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own passkeys"
  ON public.passkeys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own passkeys"
  ON public.passkeys FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER passkeys_updated
  BEFORE UPDATE ON public.passkeys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS passkeys_user_id_idx ON public.passkeys(user_id);

-- 3) Short-lived WebAuthn challenges (server-only; no client access at all)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  user_id uuid,
  challenge text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.webauthn_challenges TO service_role;

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (server functions) may touch this table.

CREATE INDEX IF NOT EXISTS webauthn_challenges_lookup_idx ON public.webauthn_challenges(email, purpose, created_at DESC);