-- Migration to add system_serial column to licenses and sub_vendo_licenses
-- Also handles hwid column for consistency if it exists or needs to be created

DO $$ 
BEGIN 
    -- 1. Add system_serial to licenses if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'licenses' AND column_name = 'system_serial') THEN
        ALTER TABLE licenses ADD COLUMN system_serial VARCHAR(255);
    END IF;

    -- 2. Add hwid to licenses if not exists (to match user's observed schema)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'licenses' AND column_name = 'hwid') THEN
        ALTER TABLE licenses ADD COLUMN hwid VARCHAR(255);
    END IF;

    -- 3. Add system_serial to sub_vendo_licenses if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sub_vendo_licenses' AND column_name = 'system_serial') THEN
        ALTER TABLE sub_vendo_licenses ADD COLUMN system_serial VARCHAR(255);
    END IF;

    -- 4. Add hwid to sub_vendo_licenses if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sub_vendo_licenses' AND column_name = 'hwid') THEN
        ALTER TABLE sub_vendo_licenses ADD COLUMN hwid VARCHAR(255);
    END IF;
END $$;

-- 5. Backfill system_serial from hardware_id OR hwid
-- Priority: hardware_id > hwid
UPDATE licenses 
SET system_serial = COALESCE(hardware_id, hwid)
WHERE system_serial IS NULL AND (hardware_id IS NOT NULL OR hwid IS NOT NULL);

-- 6. Backfill hwid from hardware_id (sync all columns)
UPDATE licenses 
SET hwid = hardware_id
WHERE hwid IS NULL AND hardware_id IS NOT NULL;

-- 7. Backfill hardware_id from hwid (sync all columns)
UPDATE licenses 
SET hardware_id = hwid
WHERE hardware_id IS NULL AND hwid IS NOT NULL;

-- Repeat for sub_vendo_licenses
UPDATE sub_vendo_licenses 
SET system_serial = COALESCE(hardware_id, hwid)
WHERE system_serial IS NULL AND (hardware_id IS NOT NULL OR hwid IS NOT NULL);

UPDATE sub_vendo_licenses 
SET hwid = hardware_id
WHERE hwid IS NULL AND hardware_id IS NOT NULL;

UPDATE sub_vendo_licenses 
SET hardware_id = hwid
WHERE hardware_id IS NULL AND hwid IS NOT NULL;

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_licenses_system_serial ON licenses(system_serial);
CREATE INDEX IF NOT EXISTS idx_sub_vendo_licenses_system_serial ON sub_vendo_licenses(system_serial);
