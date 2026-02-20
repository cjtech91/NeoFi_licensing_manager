BEGIN;

UPDATE public.licenses
SET status = 'active',
    hardware_id = NULL,
    activated_at = NULL
WHERE status = 'revoked';

COMMIT;
