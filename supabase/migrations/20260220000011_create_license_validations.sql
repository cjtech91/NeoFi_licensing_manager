BEGIN;

CREATE TABLE IF NOT EXISTS public.license_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  hwid VARCHAR(255) NOT NULL,
  allowed BOOLEAN NOT NULL,
  status VARCHAR(32) NOT NULL,
  message TEXT,
  device_model VARCHAR(100),
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_validations_license_id ON public.license_validations(license_id);
CREATE INDEX IF NOT EXISTS idx_license_validations_created_at ON public.license_validations(created_at DESC);

ALTER TABLE public.license_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS license_validations_select_own ON public.license_validations;
CREATE POLICY license_validations_select_own ON public.license_validations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.licenses l
      WHERE l.id = license_validations.license_id
        AND l.created_by = auth.uid()
    )
  );

COMMIT;
