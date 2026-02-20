BEGIN;

DROP POLICY IF EXISTS "licenses_select_own" ON public.licenses;

CREATE POLICY "licenses_select_broad" ON public.licenses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL);

COMMIT;
