BEGIN;

-- Auto-mark license as used when system_serial is set
CREATE OR REPLACE FUNCTION public.handle_license_activation_serial()
RETURNS TRIGGER AS $$
BEGIN
  -- If system_serial is being set (was null, now not null)
  IF OLD.system_serial IS NULL AND NEW.system_serial IS NOT NULL THEN
    NEW.status := 'used';
    IF NEW.activated_at IS NULL THEN
      NEW.activated_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_license_activation_serial ON public.licenses;
CREATE TRIGGER on_license_activation_serial
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_license_activation_serial();

-- Ensure revocation clears system_serial too
CREATE OR REPLACE FUNCTION public.handle_license_revocation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'revoked' AND NEW.status = 'revoked' THEN
    NEW.hardware_id := NULL;
    NEW.hwid := NULL;
    NEW.system_serial := NULL;
    NEW.activated_at := NULL;
    NEW.machine_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to use the updated function (idempotent)
DROP TRIGGER IF EXISTS on_license_revocation ON public.licenses;
CREATE TRIGGER on_license_revocation
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_license_revocation();

COMMIT;
