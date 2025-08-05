-- Migration: Rename payments table to debtor_payments
-- Created: 2025-07-29

-- ============================================================================
-- RENAME TABLE
-- ============================================================================

-- Rename payments to debtor_payments
ALTER TABLE payments RENAME TO debtor_payments;

-- ============================================================================
-- UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Update foreign key constraints for debtor_payments
ALTER TABLE debtor_payments DROP CONSTRAINT IF EXISTS payments_debtor_id_fkey;
ALTER TABLE debtor_payments ADD CONSTRAINT debtor_payments_debtor_id_fkey
    FOREIGN KEY (debtor_id) REFERENCES debt_accounts(id) ON DELETE CASCADE;

-- ============================================================================
-- UPDATE INDEXES
-- ============================================================================

-- Rename indexes for debtor_payments
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_debtor_id') THEN
        ALTER INDEX idx_payments_debtor_id RENAME TO idx_debtor_payments_debtor_id;
    END IF;
END $$;



DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_payment_date') THEN
        ALTER INDEX idx_payments_payment_date RENAME TO idx_debtor_payments_payment_date;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_payment_type') THEN
        ALTER INDEX idx_payments_payment_type RENAME TO idx_debtor_payments_payment_type;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_created_at') THEN
        ALTER INDEX idx_payments_created_at RENAME TO idx_debtor_payments_created_at;
    END IF;
END $$;

-- ============================================================================
-- UPDATE RLS POLICIES
-- ============================================================================

-- Drop existing policies for payments table
DROP POLICY IF EXISTS "Platform admin full access" ON debtor_payments;
DROP POLICY IF EXISTS "Agency users can view payments" ON debtor_payments;
DROP POLICY IF EXISTS "Agency users can insert payments" ON debtor_payments;
DROP POLICY IF EXISTS "Agency users can update payments" ON debtor_payments;
DROP POLICY IF EXISTS "Agency users can delete payments" ON debtor_payments;

-- Create new policies for debtor_payments table
CREATE POLICY "Platform admin full access" ON debtor_payments FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.role_type = 'platform_admin'
    )
);

CREATE POLICY "Agency users can view payments" ON debtor_payments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_payments.debtor_id
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

CREATE POLICY "Agency users can insert payments" ON debtor_payments FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_payments.debtor_id
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

CREATE POLICY "Agency users can update payments" ON debtor_payments FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_payments.debtor_id
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

CREATE POLICY "Agency users can delete payments" ON debtor_payments FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.id = debtor_payments.debtor_id
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

COMMENT ON TABLE debtor_payments IS 'Payments associated with debt accounts'; 