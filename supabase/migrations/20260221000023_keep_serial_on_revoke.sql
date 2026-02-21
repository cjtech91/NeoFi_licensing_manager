BEGIN;

-- Modify handle_license_revocation to preserve bindings when revoked
-- This allows the device to receive the "Revoked" status instead of "Not Found"
CREATE OR REPLACE FUNCTION public.handle_license_revocation()
RETURNS TRIGGER AS $$
BEGIN
  -- We no longer clear hardware_id/system_serial when revoking
  -- This ensures the specific device knows its license was revoked
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
