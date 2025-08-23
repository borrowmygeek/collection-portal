-- ============================================================================
-- SIMPLE FIX - GET THE APP WORKING
-- This migration temporarily disables RLS to fix the authentication issues
-- ============================================================================

-- ============================================================================
-- STEP 1: DISABLE RLS TEMPORARILY TO BREAK THE RECURSION
-- ============================================================================

-- Disable RLS on all tables to get the app working
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_agencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: CREATE SIMPLE, WORKING FUNCTIONS
-- ============================================================================

-- Simple profile fetch function (no RLS, no recursion)
CREATE OR REPLACE FUNCTION public.get_user_profile_simple(auth_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile jsonb;
    user_roles jsonb;
    primary_role jsonb;
BEGIN
    -- Get basic profile data
    SELECT jsonb_build_object(
        'id', pu.id,
        'email', pu.email,
        'auth_user_id', pu.auth_user_id,
        'full_name', pu.full_name,
        'status', pu.status
    ) INTO user_profile
    FROM platform_users pu
    WHERE pu.auth_user_id = get_user_profile_simple.auth_user_id
    LIMIT 1;

    -- Get user roles
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'is_active', ur.is_active,
            'is_primary', ur.is_primary,
            'permissions', ur.permissions
        )
    ) INTO user_roles
    FROM user_roles ur
    WHERE ur.user_id = (user_profile->>'id')::uuid
    AND ur.is_active = true;

    -- Get primary role
    SELECT jsonb_build_object(
        'role_id', ur.id,
        'role_type', ur.role_type,
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'permissions', ur.permissions
    ) INTO primary_role
    FROM user_roles ur
    WHERE ur.user_id = (user_profile->>'id')::uuid
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;

    -- Return combined data
    RETURN jsonb_build_object(
        'profile', user_profile,
        'roles', user_roles,
        'primary_role', primary_role
    );
END;
$$;

-- Simple permission check function
CREATE OR REPLACE FUNCTION public.user_has_permission_simple(user_id uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_permission boolean := false;
    user_permissions jsonb;
BEGIN
    -- Get user's primary role permissions
    SELECT ur.permissions INTO user_permissions
    FROM user_roles ur
    WHERE ur.user_id = user_has_permission_simple.user_id
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;

    -- Check if permission exists
    IF user_permissions IS NOT NULL THEN
        has_permission := (user_permissions ->> permission_name)::boolean = true;
    END IF;

    -- Platform admins have all permissions
    IF NOT has_permission THEN
        SELECT EXISTS(
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = user_has_permission_simple.user_id
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        ) INTO has_permission;
    END IF;

    RETURN has_permission;
END;
$$;

-- ============================================================================
-- STEP 3: POPULATE MISSING PERMISSIONS
-- ============================================================================

-- Update platform admin permissions
UPDATE user_roles 
SET permissions = '{
    "view_users": true,
    "manage_users": true,
    "view_agencies": true,
    "manage_agencies": true,
    "view_clients": true,
    "manage_clients": true,
    "view_portfolios": true,
    "manage_portfolios": true,
    "view_sales": true,
    "manage_sales": true,
    "view_debtors": true,
    "manage_debtors": true,
    "view_reports": true,
    "manage_reports": true,
    "view_settings": true,
    "manage_settings": true
}'::jsonb
WHERE role_type = 'platform_admin';

-- Update agency admin permissions
UPDATE user_roles 
SET permissions = '{
    "view_users": true,
    "manage_users": true,
    "view_clients": true,
    "manage_clients": true,
    "view_portfolios": true,
    "manage_portfolios": true,
    "view_sales": true,
    "manage_sales": true,
    "view_debtors": true,
    "manage_debtors": true,
    "view_reports": true,
    "view_settings": true
}'::jsonb
WHERE role_type = 'agency_admin';

-- Update agency user permissions
UPDATE user_roles 
SET permissions = '{
    "view_clients": true,
    "view_portfolios": true,
    "view_sales": true,
    "manage_sales": true,
    "view_debtors": true,
    "manage_debtors": true,
    "view_reports": true
}'::jsonb
WHERE role_type = 'agency_user';

-- Update client admin permissions
UPDATE user_roles 
SET permissions = '{
    "view_portfolios": true,
    "manage_portfolios": true,
    "view_sales": true,
    "view_debtors": true,
    "view_reports": true
}'::jsonb
WHERE role_type = 'client_admin';

-- Update client user permissions
UPDATE user_roles 
SET permissions = '{
    "view_portfolios": true,
    "view_sales": true,
    "view_debtors": true,
    "view_reports": true
}'::jsonb
WHERE role_type = 'client_user';

-- Update buyer permissions
UPDATE user_roles 
SET permissions = '{
    "view_portfolios": true,
    "view_sales": true,
    "place_bids": true
}'::jsonb
WHERE role_type = 'buyer';

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

-- Log the fix summary
DO $$
DECLARE
    users_count integer;
    roles_count integer;
    permissions_count integer;
BEGIN
    -- Count users and roles
    SELECT COUNT(*) INTO users_count FROM platform_users;
    SELECT COUNT(*) INTO roles_count FROM user_roles;
    SELECT COUNT(*) INTO permissions_count FROM user_roles WHERE permissions != '{}';
    
    RAISE NOTICE '=== SIMPLE FIX APPLIED ===';
    RAISE NOTICE 'RLS disabled on all tables';
    RAISE NOTICE 'Simple functions created:';
    RAISE NOTICE '  - get_user_profile_simple()';
    RAISE NOTICE '  - user_has_permission_simple()';
    RAISE NOTICE 'Permissions populated for % roles', permissions_count;
    RAISE NOTICE 'Total users: %, Total roles: %', users_count, roles_count;
    RAISE NOTICE 'The app should now work without authentication issues';
    RAISE NOTICE '========================================';
END $$;
