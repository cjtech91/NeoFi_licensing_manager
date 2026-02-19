ALTER TABLE public.licenses ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Users can create licenses" ON public.licenses;
CREATE POLICY "Users can create licenses" ON public.licenses
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
