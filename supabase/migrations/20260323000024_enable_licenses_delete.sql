BEGIN;

DROP POLICY IF EXISTS "licenses_delete_own" ON public.licenses;
CREATE POLICY "licenses_delete_own" ON public.licenses
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

COMMIT;
