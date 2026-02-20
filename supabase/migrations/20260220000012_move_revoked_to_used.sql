BEGIN;

UPDATE public.licenses
SET status = 'used',
    activated_at = COALESCE(activated_at, NOW())
WHERE status = 'revoked';

COMMIT;
