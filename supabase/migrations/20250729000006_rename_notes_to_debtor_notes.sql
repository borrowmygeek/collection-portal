-- Migration: Rename notes table to debtor_notes
-- Created: 2025-07-29

-- ============================================================================
-- RENAME TABLE
-- ============================================================================

-- Rename notes to debtor_notes
ALTER TABLE notes RENAME TO debtor_notes;

-- ============================================================================
-- UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Update foreign key constraints for debtor_notes
ALTER TABLE debtor_notes DROP CONSTRAINT IF EXISTS notes_debtor_id_fkey;
ALTER TABLE debtor_notes ADD CONSTRAINT debtor_notes_debtor_id_fkey
    FOREIGN KEY (debtor_id) REFERENCES debt_accounts(id) ON DELETE CASCADE;

ALTER TABLE debtor_notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
ALTER TABLE debtor_notes ADD CONSTRAINT debtor_notes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE;

-- ============================================================================
-- UPDATE INDEXES
-- ============================================================================

-- Rename indexes for debtor_notes
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notes_debtor_id') THEN
        ALTER INDEX idx_notes_debtor_id RENAME TO idx_debtor_notes_debtor_id;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notes_user_id') THEN
        ALTER INDEX idx_notes_user_id RENAME TO idx_debtor_notes_user_id;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notes_note_type') THEN
        ALTER INDEX idx_notes_note_type RENAME TO idx_debtor_notes_note_type;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notes_created_at') THEN
        ALTER INDEX idx_notes_created_at RENAME TO idx_debtor_notes_created_at;
    END IF;
END $$;

-- ============================================================================
-- UPDATE RLS POLICIES
-- ============================================================================

-- Drop existing policies for notes table
DROP POLICY IF EXISTS "Platform admin full access" ON debtor_notes;
DROP POLICY IF EXISTS "Agency users can view debtor notes" ON debtor_notes;
DROP POLICY IF EXISTS "Agency users can insert debtor notes" ON debtor_notes;
DROP POLICY IF EXISTS "Agency users can update debtor notes" ON debtor_notes;
DROP POLICY IF EXISTS "Agency users can delete debtor notes" ON debtor_notes;

-- Create new policies for debtor_notes table
CREATE POLICY "Platform admin full access" ON debtor_notes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.role_type = 'platform_admin'
    )
);

CREATE POLICY "Agency users can view debtor notes" ON debtor_notes FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_notes.debtor_id
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
            AND (
                ur.role_type = 'platform_admin' OR
                ur.role_type IN ('agency_admin', 'agency_user')
            )
        )
    )
);

CREATE POLICY "Agency users can insert debtor notes" ON debtor_notes FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_notes.debtor_id
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
            AND (
                ur.role_type = 'platform_admin' OR
                ur.role_type IN ('agency_admin', 'agency_user')
            )
        )
    )
);

CREATE POLICY "Agency users can update debtor notes" ON debtor_notes FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_notes.debtor_id
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
            AND (
                ur.role_type = 'platform_admin' OR
                ur.role_type IN ('agency_admin', 'agency_user')
            )
        )
    )
);

CREATE POLICY "Agency users can delete debtor notes" ON debtor_notes FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_notes.debtor_id
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
            AND (
                ur.role_type = 'platform_admin' OR
                ur.role_type IN ('agency_admin', 'agency_user')
            )
        )
    )
);

-- ============================================================================
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON TABLE debtor_notes IS 'Notes associated with debt accounts'; 