BEGIN;

-- Ensure only one license can be bound to a single hardware_id
DROP INDEX IF EXISTS public.licenses_hardware_id_unique;

-- Clean up existing revoked bindings before enforcing uniqueness
UPDATE public.licenses
SET hardware_id = NULL,
    activated_at = NULL,
    machine_id = NULL
WHERE status = 'revoked' AND hardware_id IS NOT NULL;

CREATE UNIQUE INDEX licenses_hardware_id_unique
ON public.licenses (hardware_id)
WHERE hardware_id IS NOT NULL;

COMMIT;
