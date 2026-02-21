-- Migration to add system_serial column to licenses and sub_vendo_licenses
-- Also backfills data from hardware_id and sets up future handling

-- 1. Add system_serial column to licenses
ALTER TABLE licenses 
ADD COLUMN system_serial VARCHAR(255);

-- 2. Backfill system_serial from hardware_id (preserve existing data)
UPDATE licenses 
SET system_serial = hardware_id 
WHERE hardware_id IS NOT NULL;

-- 3. Create index for performance
CREATE INDEX idx_licenses_system_serial ON licenses(system_serial);


-- 4. Add system_serial column to sub_vendo_licenses
ALTER TABLE sub_vendo_licenses 
ADD COLUMN system_serial VARCHAR(255);

-- 5. Backfill sub_vendo_licenses
UPDATE sub_vendo_licenses 
SET system_serial = hardware_id 
WHERE hardware_id IS NOT NULL;

-- 6. Create index for sub_vendo_licenses
CREATE INDEX idx_sub_vendo_licenses_system_serial ON sub_vendo_licenses(system_serial);

-- Note: We are keeping hardware_id for now to ensure backward compatibility during deployment,
-- but the application will switch to using system_serial as the primary field.
