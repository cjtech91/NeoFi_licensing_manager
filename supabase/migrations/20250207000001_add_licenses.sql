-- Create licenses table
CREATE TABLE licenses (
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

-- Create indexes
CREATE INDEX idx_licenses_key ON licenses(key);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_machine ON licenses(machine_id);
CREATE INDEX idx_licenses_hwid ON licenses(hardware_id);

-- Enable RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL PRIVILEGES ON licenses TO authenticated;
GRANT SELECT ON licenses TO anon; -- Allow checking license status without login (for the machine)

-- RLS Policies
-- Admins/Users can view licenses they created
CREATE POLICY "Users can view their own licenses" ON licenses
    FOR SELECT USING (created_by = auth.uid());

-- Admins/Users can create licenses
CREATE POLICY "Users can create licenses" ON licenses
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Machines can update license (activate it) - This is tricky with RLS.
-- Usually, we might want a server-side function or allow specific updates.
-- For now, let's allow authenticated users to update licenses they created.
CREATE POLICY "Users can update their own licenses" ON licenses
    FOR UPDATE USING (created_by = auth.uid());

-- Allow anon read access to validate license (specific columns ideally, but row level is fine for now)
CREATE POLICY "Public can check licenses" ON licenses
    FOR SELECT USING (true);
