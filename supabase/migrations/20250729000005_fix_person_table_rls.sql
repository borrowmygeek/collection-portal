-- Migration: Fix RLS policies for person-associated tables
-- Created: 2025-07-29

-- ============================================================================
-- FIX RLS POLICIES FOR PERSON_EMAILS
-- ============================================================================

-- Drop and recreate policies for person_emails
DROP POLICY IF EXISTS "Allow authenticated users to view person emails" ON person_emails;
DROP POLICY IF EXISTS "Allow authenticated users to insert person emails" ON person_emails;
DROP POLICY IF EXISTS "Allow authenticated users to update person emails" ON person_emails;
DROP POLICY IF EXISTS "Allow authenticated users to delete person emails" ON person_emails;

CREATE POLICY "Allow authenticated users to view person emails" ON person_emails
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_emails.person_id
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

CREATE POLICY "Allow authenticated users to insert person emails" ON person_emails
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_emails.person_id
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

CREATE POLICY "Allow authenticated users to update person emails" ON person_emails
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_emails.person_id
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

CREATE POLICY "Allow authenticated users to delete person emails" ON person_emails
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_emails.person_id
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
-- FIX RLS POLICIES FOR PERSON_PHONES
-- ============================================================================

-- Drop and recreate policies for person_phones
DROP POLICY IF EXISTS "Allow authenticated users to view person phones" ON person_phones;
DROP POLICY IF EXISTS "Allow authenticated users to insert person phones" ON person_phones;
DROP POLICY IF EXISTS "Allow authenticated users to update person phones" ON person_phones;
DROP POLICY IF EXISTS "Allow authenticated users to delete person phones" ON person_phones;

CREATE POLICY "Allow authenticated users to view person phones" ON person_phones
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_phones.person_id
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

CREATE POLICY "Allow authenticated users to insert person phones" ON person_phones
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_phones.person_id
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

CREATE POLICY "Allow authenticated users to update person phones" ON person_phones
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_phones.person_id
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

CREATE POLICY "Allow authenticated users to delete person phones" ON person_phones
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_phones.person_id
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
-- FIX RLS POLICIES FOR PERSON_RELATIVES
-- ============================================================================

-- Drop and recreate policies for person_relatives
DROP POLICY IF EXISTS "Allow authenticated users to view person relatives" ON person_relatives;
DROP POLICY IF EXISTS "Allow authenticated users to insert person relatives" ON person_relatives;
DROP POLICY IF EXISTS "Allow authenticated users to update person relatives" ON person_relatives;
DROP POLICY IF EXISTS "Allow authenticated users to delete person relatives" ON person_relatives;

CREATE POLICY "Allow authenticated users to view person relatives" ON person_relatives
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_relatives.person_id
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

CREATE POLICY "Allow authenticated users to insert person relatives" ON person_relatives
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_relatives.person_id
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

CREATE POLICY "Allow authenticated users to update person relatives" ON person_relatives
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_relatives.person_id
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

CREATE POLICY "Allow authenticated users to delete person relatives" ON person_relatives
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_relatives.person_id
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
-- FIX RLS POLICIES FOR PERSON_PROPERTIES
-- ============================================================================

-- Drop and recreate policies for person_properties
DROP POLICY IF EXISTS "Allow authenticated users to view person properties" ON person_properties;
DROP POLICY IF EXISTS "Allow authenticated users to insert person properties" ON person_properties;
DROP POLICY IF EXISTS "Allow authenticated users to update person properties" ON person_properties;
DROP POLICY IF EXISTS "Allow authenticated users to delete person properties" ON person_properties;

CREATE POLICY "Allow authenticated users to view person properties" ON person_properties
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_properties.person_id
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

CREATE POLICY "Allow authenticated users to insert person properties" ON person_properties
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_properties.person_id
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

CREATE POLICY "Allow authenticated users to update person properties" ON person_properties
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_properties.person_id
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

CREATE POLICY "Allow authenticated users to delete person properties" ON person_properties
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_properties.person_id
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
-- FIX RLS POLICIES FOR PERSON_VEHICLES
-- ============================================================================

-- Drop and recreate policies for person_vehicles
DROP POLICY IF EXISTS "Allow authenticated users to view person vehicles" ON person_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to insert person vehicles" ON person_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to update person vehicles" ON person_vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to delete person vehicles" ON person_vehicles;

CREATE POLICY "Allow authenticated users to view person vehicles" ON person_vehicles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_vehicles.person_id
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

CREATE POLICY "Allow authenticated users to insert person vehicles" ON person_vehicles
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_vehicles.person_id
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

CREATE POLICY "Allow authenticated users to update person vehicles" ON person_vehicles
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_vehicles.person_id
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

CREATE POLICY "Allow authenticated users to delete person vehicles" ON person_vehicles
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_vehicles.person_id
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
-- FIX RLS POLICIES FOR PERSON_EMPLOYMENTS
-- ============================================================================

-- Drop and recreate policies for person_employments
DROP POLICY IF EXISTS "Allow authenticated users to view person employments" ON person_employments;
DROP POLICY IF EXISTS "Allow authenticated users to insert person employments" ON person_employments;
DROP POLICY IF EXISTS "Allow authenticated users to update person employments" ON person_employments;
DROP POLICY IF EXISTS "Allow authenticated users to delete person employments" ON person_employments;

CREATE POLICY "Allow authenticated users to view person employments" ON person_employments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_employments.person_id
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

CREATE POLICY "Allow authenticated users to insert person employments" ON person_employments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_employments.person_id
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

CREATE POLICY "Allow authenticated users to update person employments" ON person_employments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_employments.person_id
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

CREATE POLICY "Allow authenticated users to delete person employments" ON person_employments
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_employments.person_id
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
-- FIX RLS POLICIES FOR PERSON_BANKRUPTCIES
-- ============================================================================

-- Drop and recreate policies for person_bankruptcies
DROP POLICY IF EXISTS "Allow authenticated users to view person bankruptcies" ON person_bankruptcies;
DROP POLICY IF EXISTS "Allow authenticated users to insert person bankruptcies" ON person_bankruptcies;
DROP POLICY IF EXISTS "Allow authenticated users to update person bankruptcies" ON person_bankruptcies;
DROP POLICY IF EXISTS "Allow authenticated users to delete person bankruptcies" ON person_bankruptcies;

CREATE POLICY "Allow authenticated users to view person bankruptcies" ON person_bankruptcies
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_bankruptcies.person_id
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

CREATE POLICY "Allow authenticated users to insert person bankruptcies" ON person_bankruptcies
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_bankruptcies.person_id
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

CREATE POLICY "Allow authenticated users to update person bankruptcies" ON person_bankruptcies
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_bankruptcies.person_id
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

CREATE POLICY "Allow authenticated users to delete person bankruptcies" ON person_bankruptcies
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debt_accounts da
            JOIN persons p ON da.person_id = p.id
            WHERE p.id = person_bankruptcies.person_id
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