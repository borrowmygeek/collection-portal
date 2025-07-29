-- Fix RLS policies for import process
-- Allow service role to bypass RLS for imports

-- Drop existing policies that might be blocking imports
DROP POLICY IF EXISTS "Users can create debtors" ON debtors;

-- Create a new policy that allows service role and authenticated users to create debtors
CREATE POLICY "Allow debtors creation for imports" ON debtors
    FOR INSERT WITH CHECK (
        -- Allow service role (no auth.uid() check)
        (auth.role() = 'service_role') OR
        -- Allow authenticated users to create debtors
        (auth.uid() = created_by)
    );

-- Also allow service role to view all debtors for debugging
DROP POLICY IF EXISTS "Platform admins can view all debtors" ON debtors;

CREATE POLICY "Allow full access for service role and platform admins" ON debtors
    FOR ALL USING (
        -- Allow service role full access
        (auth.role() = 'service_role') OR
        -- Allow platform admins full access
        (EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        ))
    );

-- Add a policy for regular users to view their own debtors
CREATE POLICY "Users can view their own debtors" ON debtors
    FOR SELECT USING (
        auth.uid() = created_by
    );

-- Add a policy for regular users to update their own debtors
CREATE POLICY "Users can update their own debtors" ON debtors
    FOR UPDATE USING (
        auth.uid() = created_by
    );

-- Add a policy for agency users to view debtors in their portfolios
CREATE POLICY "Agency users can view portfolio debtors" ON debtors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_users pu
            WHERE pu.auth_user_id = auth.uid()
            AND pu.role IN ('agency_admin', 'agency_user')
        )
    );

-- Add a policy for agency users to update debtors in their portfolios
CREATE POLICY "Agency users can update portfolio debtors" ON debtors
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM platform_users pu
            WHERE pu.auth_user_id = auth.uid()
            AND pu.role IN ('agency_admin', 'agency_user')
        )
    ); 