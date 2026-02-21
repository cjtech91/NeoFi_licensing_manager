BEGIN;

-- Replace hardware_id-based activation policy with system_serial-based policy
DROP POLICY IF EXISTS "Machines can activate license" ON public.licenses;
CREATE POLICY "Machines can activate license" ON public.licenses
  FOR UPDATE
  TO anon
  USING (system_serial IS NULL AND status = 'active')
  WITH CHECK (system_serial IS NOT NULL AND status = 'active');

COMMIT;
