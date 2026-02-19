-- Ensure created_by is always set from auth context on license insert
CREATE OR REPLACE FUNCTION public.licenses_set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS licenses_set_created_by ON public.licenses;
CREATE TRIGGER licenses_set_created_by
  BEFORE INSERT ON public.licenses
  FOR EACH ROW
  EXECUTE PROCEDURE public.licenses_set_created_by();

-- Backfill users so foreign key passes for current and existing accounts
INSERT INTO public.users (id, email, password_hash, role)
SELECT au.id, au.email, 'managed_by_supabase_auth', 'operator'
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;

-- Allow self-heal from client if needed
CREATE POLICY IF NOT EXISTS "Users can create their own profile" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);
