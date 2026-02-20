BEGIN;

DROP POLICY IF EXISTS "Machines can activate license" ON public.licenses;
CREATE POLICY "Machines can activate license" ON public.licenses
  FOR UPDATE
  TO anon
  USING (hardware_id IS NULL AND status = 'active')
  WITH CHECK (hardware_id IS NOT NULL AND status = 'active');

CREATE OR REPLACE FUNCTION public.enforce_revoked_no_hardware()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'revoked' OR OLD.status = 'revoked') AND NEW.hardware_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot bind hardware_id on a revoked license';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_revoked_no_hardware ON public.licenses;
CREATE TRIGGER enforce_revoked_no_hardware
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_revoked_no_hardware();

COMMIT;
