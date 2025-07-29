-- Fix RLS Policies for Clients and Portfolios
-- This updates the policies to use the proper JWT claims function

-- Drop existing policies that use auth.jwt() directly
DROP POLICY IF EXISTS "Platform admin full access" ON master_clients;
DROP POLICY IF EXISTS "Platform admin full access" ON master_portfolios;
DROP POLICY IF EXISTS "Platform admin full access" ON master_portfolio_placements;

-- Create new policies using the get_user_claims() function
CREATE POLICY "Platform admin full access" ON master_clients 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_portfolios 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_portfolio_placements 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Add policies for agency users to see portfolios they have placements for
CREATE POLICY "Agency users can view assigned portfolios" ON master_portfolios 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM master_portfolio_placements mpp
            WHERE mpp.portfolio_id = master_portfolios.id
            AND mpp.agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    );

-- Add policies for agency users to see their portfolio placements
CREATE POLICY "Agency users can view own placements" ON master_portfolio_placements 
    FOR SELECT USING (agency_id = (public.get_user_claims() ->> 'agency_id')::uuid);

-- Add policies for agency users to see clients they have portfolios for
CREATE POLICY "Agency users can view assigned clients" ON master_clients 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM master_portfolios mp
            JOIN master_portfolio_placements mpp ON mp.id = mpp.portfolio_id
            WHERE mp.client_id = master_clients.id
            AND mpp.agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    );

-- Verify the policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('master_clients', 'master_portfolios', 'master_portfolio_placements')
ORDER BY tablename, policyname; 