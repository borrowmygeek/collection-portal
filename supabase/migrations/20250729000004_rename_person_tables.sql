-- Migration: Rename person-associated tables to person_* convention
-- Created: 2025-07-29

-- ============================================================================
-- RENAME TABLES
-- ============================================================================

-- Rename emails to person_emails
ALTER TABLE emails RENAME TO person_emails;

-- Rename phone_numbers to person_phones
ALTER TABLE phone_numbers RENAME TO person_phones;

-- Rename relatives to person_relatives
ALTER TABLE relatives RENAME TO person_relatives;

-- Rename properties to person_properties
ALTER TABLE properties RENAME TO person_properties;

-- Rename vehicles to person_vehicles
ALTER TABLE vehicles RENAME TO person_vehicles;

-- Rename places_of_employment to person_employments
ALTER TABLE places_of_employment RENAME TO person_employments;

-- Rename bankruptcies to person_bankruptcies
ALTER TABLE bankruptcies RENAME TO person_bankruptcies;

-- ============================================================================
-- UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Update foreign key constraints for person_emails
ALTER TABLE person_emails DROP CONSTRAINT IF EXISTS emails_person_id_fkey;
ALTER TABLE person_emails ADD CONSTRAINT person_emails_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- Update foreign key constraints for person_phones
ALTER TABLE person_phones DROP CONSTRAINT IF EXISTS phone_numbers_person_id_fkey;
ALTER TABLE person_phones ADD CONSTRAINT person_phones_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- Update foreign key constraints for person_relatives
ALTER TABLE person_relatives DROP CONSTRAINT IF EXISTS relatives_person_id_fkey;
ALTER TABLE person_relatives ADD CONSTRAINT person_relatives_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- Update foreign key constraints for person_properties
ALTER TABLE person_properties DROP CONSTRAINT IF EXISTS properties_person_id_fkey;
ALTER TABLE person_properties ADD CONSTRAINT person_properties_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- Update foreign key constraints for person_vehicles
ALTER TABLE person_vehicles DROP CONSTRAINT IF EXISTS vehicles_person_id_fkey;
ALTER TABLE person_vehicles ADD CONSTRAINT person_vehicles_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- Update foreign key constraints for person_employments
ALTER TABLE person_employments DROP CONSTRAINT IF EXISTS places_of_employment_person_id_fkey;
ALTER TABLE person_employments ADD CONSTRAINT person_employments_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- Update foreign key constraints for person_bankruptcies
ALTER TABLE person_bankruptcies DROP CONSTRAINT IF EXISTS bankruptcies_person_id_fkey;
ALTER TABLE person_bankruptcies ADD CONSTRAINT person_bankruptcies_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

-- ============================================================================
-- UPDATE INDEXES
-- ============================================================================

-- Rename indexes for person_emails
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_emails_person_id') THEN
        ALTER INDEX idx_emails_person_id RENAME TO idx_person_emails_person_id;
    END IF;
END $$;

-- Rename indexes for person_phones
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_phone_numbers_person_id') THEN
        ALTER INDEX idx_phone_numbers_person_id RENAME TO idx_person_phones_person_id;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_phone_numbers_number') THEN
        ALTER INDEX idx_phone_numbers_number RENAME TO idx_person_phones_number;
    END IF;
END $$;

-- Rename indexes for person_relatives
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_relatives_person_id') THEN
        ALTER INDEX idx_relatives_person_id RENAME TO idx_person_relatives_person_id;
    END IF;
END $$;

-- Rename indexes for person_properties
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_properties_person_id') THEN
        ALTER INDEX idx_properties_person_id RENAME TO idx_person_properties_person_id;
    END IF;
END $$;

-- Rename indexes for person_vehicles
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vehicles_person_id') THEN
        ALTER INDEX idx_vehicles_person_id RENAME TO idx_person_vehicles_person_id;
    END IF;
END $$;

-- Rename indexes for person_employments
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_places_of_employment_person_id') THEN
        ALTER INDEX idx_places_of_employment_person_id RENAME TO idx_person_employments_person_id;
    END IF;
END $$;

-- Rename indexes for person_bankruptcies
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_bankruptcies_person_id') THEN
        ALTER INDEX idx_bankruptcies_person_id RENAME TO idx_person_bankruptcies_person_id;
    END IF;
END $$;

-- ============================================================================
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON TABLE person_emails IS 'Email addresses associated with persons';
COMMENT ON TABLE person_phones IS 'Phone numbers associated with persons';
COMMENT ON TABLE person_relatives IS 'Relatives and family members associated with persons';
COMMENT ON TABLE person_properties IS 'Properties owned by persons';
COMMENT ON TABLE person_vehicles IS 'Vehicles owned by persons';
COMMENT ON TABLE person_employments IS 'Employment information for persons';
COMMENT ON TABLE person_bankruptcies IS 'Bankruptcy records for persons'; 