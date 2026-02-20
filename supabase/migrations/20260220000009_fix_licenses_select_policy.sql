BEGIN;

DROP POLICY IF EXISTS "licenses_select_own" ON public.licenses;
DROP POLICY IF EXISTS "licenses_select_broad" ON public.licenses;

CREATE POLICY "licenses_select_all_auth" ON public.licenses
  FOR SELECT TO authenticated
  USING (true);

COMMIT;
