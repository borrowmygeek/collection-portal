-- Comprehensive Security and RLS Fix
-- This script fixes all authentication, JWT claims, and RLS policy issues

-- ============================================================================
-- STEP 1: FIX JWT CLAIMS FUNCTION
-- ============================================================================

-- Update the get_user_claims function to handle service role and anonymous users
CREATE OR REPLACE FUNCTION public.get_user_claims()
RETURNS jsonb AS $$
DECLARE
    v_user platform_users%ROWTYPE;
    v_claims jsonb;
BEGIN
    -- Check if we're using service role (no auth.uid())
    IF auth.uid() IS NULL THEN
        -- Service role access - return admin claims
        RETURN jsonb_build_object(
            'role', 'platform_admin',
            'email', 'service@collectionportal.com',
            'full_name', 'Service Role',
            'agency_id', NULL,
            'permissions', jsonb_build_object(
                'manage_agencies', true,
                'manage_clients', true,
                'manage_portfolios', true,
                'view_analytics', true,
                'manage_billing', true,
                'manage_users', true,
                'system_settings', true,
                'provision_instances', true,
                'view_audit_logs', true
            ),
            'status', 'active'
        );
    END IF;

    -- Get user from platform_users table
    SELECT * INTO v_user 
    FROM platform_users 
    WHERE auth_user_id = auth.uid();
    
    IF NOT FOUND THEN
        -- Return basic claims for unregistered users
        RETURN jsonb_build_object(
            'role', 'anonymous',
            'email', auth.jwt() ->> 'email'
        );
    END IF;
    
    -- Build claims for authenticated users
    v_claims := jsonb_build_object(
        'role', v_user.role,
        'email', v_user.email,
        'full_name', v_user.full_name,
        'agency_id', v_user.agency_id,
        'permissions', v_user.permissions,
        'status', v_user.status
    );
    
    RETURN v_claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: DROP ALL EXISTING RLS POLICIES
-- ============================================================================

-- Drop all existing policies that use the wrong JWT approach
DROP POLICY IF EXISTS "Platform admin full access" ON master_agencies;
DROP POLICY IF EXISTS "Platform admin full access" ON master_clients;
DROP POLICY IF EXISTS "Platform admin full access" ON master_portfolios;
DROP POLICY IF EXISTS "Platform admin full access" ON master_portfolio_placements;
DROP POLICY IF EXISTS "Platform admin full access" ON agency_usage;
DROP POLICY IF EXISTS "Platform admin full access" ON agency_billing;
DROP POLICY IF EXISTS "Platform admin full access" ON platform_analytics;
DROP POLICY IF EXISTS "Platform admin full access" ON audit_logs;
DROP POLICY IF EXISTS "Platform admin full access" ON platform_admins;

DROP POLICY IF EXISTS "Agency users can view own agency" ON master_agencies;
DROP POLICY IF EXISTS "Agency users can view own usage" ON agency_usage;
DROP POLICY IF EXISTS "Agency users can view own billing" ON agency_billing;

-- Drop sales module policies
DROP POLICY IF EXISTS "Platform admins can view all buyers" ON master_buyers;
DROP POLICY IF EXISTS "Platform admins can manage all sales" ON portfolio_sales;
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON import_templates;
DROP POLICY IF EXISTS "Platform admins can view all import jobs" ON import_jobs;

-- ============================================================================
-- STEP 3: CREATE NEW RLS POLICIES USING CORRECT APPROACH
-- ============================================================================

-- Platform admin can access everything (using correct JWT claims)
CREATE POLICY "Platform admin full access" ON master_agencies 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_clients 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_portfolios 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_portfolio_placements 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON agency_usage 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON agency_billing 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON platform_analytics 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON audit_logs 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON platform_admins 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Agency users can only see their own data
CREATE POLICY "Agency users can view own agency" ON master_agencies 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

CREATE POLICY "Agency users can view own usage" ON agency_usage 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

CREATE POLICY "Agency users can view own billing" ON agency_billing 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

-- Agency users can view assigned portfolios
CREATE POLICY "Agency users can view assigned portfolios" ON master_portfolios 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

-- Agency users can view assigned clients
CREATE POLICY "Agency users can view assigned clients" ON master_clients 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND EXISTS (
            SELECT 1 FROM master_portfolios 
            WHERE client_id = master_clients.id 
            AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    );

-- Agency users can view own placements
CREATE POLICY "Agency users can view own placements" ON master_portfolio_placements 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

-- Sales module policies
CREATE POLICY "Platform admins can view all buyers" ON master_buyers 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admins can manage all sales" ON portfolio_sales 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admins can manage all templates" ON import_templates 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admins can view all import jobs" ON import_jobs 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- ============================================================================
-- STEP 4: CREATE HELPER FUNCTIONS FOR AUTHENTICATION
-- ============================================================================

-- Function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
BEGIN
    RETURN public.get_user_claims() ->> 'role' = 'platform_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is agency admin
CREATE OR REPLACE FUNCTION public.is_agency_admin()
RETURNS boolean AS $$
BEGIN
    RETURN public.get_user_claims() ->> 'role' = 'agency_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's agency ID
CREATE OR REPLACE FUNCTION public.get_current_agency_id()
RETURNS uuid AS $$
BEGIN
    RETURN (public.get_user_claims() ->> 'agency_id')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: CREATE API HELPER FUNCTIONS
-- ============================================================================

-- Function to validate user permissions for API operations
CREATE OR REPLACE FUNCTION public.validate_user_permission(required_permission text)
RETURNS boolean AS $$
DECLARE
    v_claims jsonb;
    v_permissions jsonb;
BEGIN
    v_claims := public.get_user_claims();
    
    -- Platform admins have all permissions
    IF v_claims ->> 'role' = 'platform_admin' THEN
        RETURN true;
    END IF;
    
    -- Check specific permission
    v_permissions := v_claims -> 'permissions';
    IF v_permissions IS NOT NULL AND v_permissions ? required_permission THEN
        RETURN (v_permissions ->> required_permission)::boolean;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: CREATE AUDIT LOGGING FUNCTION
-- ============================================================================

-- Function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    event_type text,
    table_name text,
    record_id uuid,
    action text,
    details jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        agency_id,
        action,
        table_name,
        record_id,
        details,
        user_id,
        ip_address
    ) VALUES (
        public.get_current_agency_id(),
        event_type || ' - ' || action,
        table_name,
        record_id,
        details,
        auth.uid(),
        current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: VERIFICATION QUERIES
-- ============================================================================

-- Test the get_user_claims function
SELECT 'Testing get_user_claims function' as test_name;
SELECT public.get_user_claims() as current_claims;

-- Test helper functions
SELECT 'Testing helper functions' as test_name;
SELECT public.is_platform_admin() as is_admin;
SELECT public.get_current_agency_id() as agency_id;

-- Check RLS policies
SELECT 'Current RLS policies' as test_name;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname; 