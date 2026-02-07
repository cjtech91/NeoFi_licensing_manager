-- Allow anonymous users (machines) to activate a license if it hasn't been activated yet
-- This allows updating 'hardware_id' and 'activated_at' if 'hardware_id' is currently NULL.

CREATE POLICY "Machines can activate license" ON licenses
    FOR UPDATE
    TO anon
    USING (hardware_id IS NULL)
    WITH CHECK (hardware_id IS NOT NULL);
