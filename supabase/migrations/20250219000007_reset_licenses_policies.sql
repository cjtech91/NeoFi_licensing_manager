BEGIN;

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "licenses_insert_self" ON public.licenses;
DROP POLICY IF EXISTS "licenses_insert" ON public.licenses;
DROP POLICY IF EXISTS "Users can create licenses" ON public.licenses;
DROP POLICY IF EXISTS "licenses_select_own" ON public.licenses;
DROP POLICY IF EXISTS "licenses_update_own" ON public.licenses;
DROP POLICY IF EXISTS "licenses_delete_own" ON public.licenses;

CREATE POLICY "licenses_insert_auth" ON public.licenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "licenses_select_own" ON public.licenses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "licenses_update_own" ON public.licenses
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

COMMIT;
