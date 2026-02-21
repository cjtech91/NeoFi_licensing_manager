BEGIN;

-- Rename hwid to system_serial in license_validations to reflect new approach
ALTER TABLE public.license_validations
  RENAME COLUMN hwid TO system_serial;

COMMIT;
