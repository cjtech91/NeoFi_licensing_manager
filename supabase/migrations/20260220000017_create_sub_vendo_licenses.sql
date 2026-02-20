BEGIN;

CREATE TABLE IF NOT EXISTS public.sub_vendo_licenses (
    key TEXT PRIMARY KEY,
    hardware_id TEXT,
    status TEXT DEFAULT 'unused' CHECK (status IN ('unused', 'active', 'revoked')),
    activated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sub_vendo_licenses ENABLE ROW LEVEL SECURITY;

-- Policies as requested (adjusted for Supabase syntax if needed, but "true" is fine for public)
-- Note: User asked for "Public Read" and "Public Update".
-- "Public Update" using (true) is very permissive (allows anyone to update any row).
-- We might want to restrict update to only unused rows or specific columns if possible, but I will follow instructions first.
-- However, for security, usually we want to allow update only if status is unused (claiming it).
-- The user said "same logic as neofi app", which implies binding HWID.

DROP POLICY IF EXISTS "Public Read Sub Vendo" ON public.sub_vendo_licenses;
CREATE POLICY "Public Read Sub Vendo" ON public.sub_vendo_licenses
    FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "Public Update Sub Vendo" ON public.sub_vendo_licenses;
CREATE POLICY "Public Update Sub Vendo" ON public.sub_vendo_licenses
    FOR UPDATE
    TO anon
    USING (true);

-- Allow authenticated (admin) to do everything
DROP POLICY IF EXISTS "Admin All Sub Vendo" ON public.sub_vendo_licenses;
CREATE POLICY "Admin All Sub Vendo" ON public.sub_vendo_licenses
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMIT;
