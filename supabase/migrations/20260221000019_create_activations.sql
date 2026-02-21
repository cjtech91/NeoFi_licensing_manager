BEGIN;

CREATE TABLE IF NOT EXISTS public.activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  license_id UUID REFERENCES public.licenses(id) ON DELETE CASCADE,
  license_key TEXT,
  system_serial TEXT,
  hwid TEXT,
  device_model TEXT,
  status TEXT,
  activated_at TIMESTAMPTZ,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_activations_license_id ON public.activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_license_key ON public.activations(license_key);
CREATE INDEX IF NOT EXISTS idx_activations_system_serial ON public.activations(system_serial);
CREATE INDEX IF NOT EXISTS idx_activations_created_at ON public.activations(created_at);

ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activations_select_auth" ON public.activations;
CREATE POLICY "activations_select_auth" ON public.activations
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
