-- Fix missing RLS policies for users table
-- We need to ensure users can select their own profile to satisfy foreign key checks or just for general access.
-- Without this, even if the user exists, the client might not be able to "see" it if it tries to join.
-- However, for the foreign key constraint `created_by REFERENCES users(id)`, the database system check bypasses RLS.
-- RLS only affects what the *user* can query.
-- But the issue described is likely that the user row DOES NOT EXIST.

-- 1. Enable RLS is already done in initial_schema.sql, but no policies were added.
-- Let's allow users to read their own data.
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Let's allow users to update their own data.
CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- 2. Create a trigger to automatically create a public.users row when a new user signs up via Auth.
-- This fixes the root cause: "Foreign key violation" because the user doesn't exist in public.users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, password_hash, role)
  VALUES (
    new.id, 
    new.email, 
    'managed_by_supabase_auth', -- Placeholder required by NOT NULL constraint
    'operator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. (Optional) Manual fix for the currently logged-in user if they are missing.
-- Run this block if you are already logged in but can't create licenses.
-- You can run this specific INSERT statement in the SQL Editor, replacing the values with your actual user details.
-- OR, just sign up a new user after applying this migration.

-- Example for manual fix (do not run as part of migration unless you know the ID):
-- INSERT INTO public.users (id, email, password_hash, role)
-- SELECT id, email, 'managed_by_supabase_auth', 'operator'
-- FROM auth.users
-- WHERE id = auth.uid()
-- ON CONFLICT (id) DO NOTHING;
