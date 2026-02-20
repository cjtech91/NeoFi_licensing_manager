BEGIN;

-- Automatically clear bindings when a license is revoked
CREATE OR REPLACE FUNCTION public.handle_license_revocation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'revoked' AND NEW.status = 'revoked' THEN
    NEW.hardware_id := NULL;
    NEW.activated_at := NULL;
    NEW.machine_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_license_revocation ON public.licenses;
CREATE TRIGGER on_license_revocation
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_license_revocation();

COMMIT;
