BEGIN;

DROP POLICY IF EXISTS "Machines can activate license" ON public.licenses;
CREATE POLICY "Machines can activate license" ON public.licenses
  FOR UPDATE
  TO anon
  USING (hardware_id IS NULL AND status IN ('active','revoked'))
  WITH CHECK (hardware_id IS NOT NULL AND status IN ('active','revoked'));

DROP TRIGGER IF EXISTS enforce_revoked_no_hardware ON public.licenses;
DROP FUNCTION IF EXISTS public.enforce_revoked_no_hardware();

COMMIT;
