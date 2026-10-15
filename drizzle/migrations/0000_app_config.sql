CREATE TABLE public.app_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_supported_version text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read app config" ON public.app_config FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.app_config (id, min_supported_version) VALUES (1, NULL) ON CONFLICT DO NOTHING;