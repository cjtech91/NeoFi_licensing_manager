-- 1. Create licenses table (from 20250207000001_add_licenses.sql)
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked')),
    type VARCHAR(20) DEFAULT 'lifetime' CHECK (type IN ('lifetime', 'subscription', 'trial')),
    machine_id UUID REFERENCES machines(id),
    hardware_id VARCHAR(255),
    created_by UUID REFERENCES users(id),
    activated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_machine ON licenses(machine_id);
CREATE INDEX IF NOT EXISTS idx_licenses_hwid ON licenses(hardware_id);

-- Enable RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL PRIVILEGES ON licenses TO authenticated;
GRANT SELECT ON licenses TO anon;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own licenses" ON licenses;
CREATE POLICY "Users can view their own licenses" ON licenses
    FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can create licenses" ON licenses;
CREATE POLICY "Users can create licenses" ON licenses
    FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own licenses" ON licenses;
CREATE POLICY "Users can update their own licenses" ON licenses
    FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Public can check licenses" ON licenses;
CREATE POLICY "Public can check licenses" ON licenses
    FOR SELECT USING (true);

-- 2. Allow activation (from 20250207000002_allow_activation.sql)
DROP POLICY IF EXISTS "Machines can activate license" ON licenses;
CREATE POLICY "Machines can activate license" ON licenses
    FOR UPDATE
    TO anon
    USING (hardware_id IS NULL)
    WITH CHECK (hardware_id IS NOT NULL);

-- 3. Fix users sync (from 20250207000003_fix_users_sync.sql)
-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, password_hash, role)
  VALUES (
    new.id, 
    new.email, 
    'managed_by_supabase_auth', 
    'operator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- FIX FOR CURRENT USER (IMPORTANT!)
INSERT INTO public.users (id, email, password_hash, role)
SELECT id, email, 'managed_by_supabase_auth', 'operator'
FROM auth.users
WHERE id = auth.uid()
ON CONFLICT (id) DO NOTHING;
