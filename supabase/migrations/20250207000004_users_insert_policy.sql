-- Allow users to insert their own profile via client (used for self-heal)
CREATE POLICY IF NOT EXISTS "Users can create their own profile" ON users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Backfill: ensure all auth.users exist in public.users
INSERT INTO public.users (id, email, password_hash, role)
SELECT au.id, au.email, 'managed_by_supabase_auth', 'operator'
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;
