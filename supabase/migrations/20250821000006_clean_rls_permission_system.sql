-- ============================================================================
-- CLEAN RLS PERMISSION SYSTEM - PHASE 1
-- This migration creates a clean, non-recursive permission system
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE CLEAN PERMISSION FUNCTIONS
-- ============================================================================

-- Function to check if user is platform admin (no recursion)
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean := false;
BEGIN
    -- Simple, direct check without recursion
    SELECT EXISTS(
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = user_id
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    ) INTO is_admin;
    
    RETURN is_admin;
END;
$$;

-- Function to get user's primary role (no recursion)
CREATE OR REPLACE FUNCTION public.get_user_primary_role(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    primary_role jsonb;
BEGIN
    -- Simple, direct query without recursion
    SELECT jsonb_build_object(
        'role_id', ur.id,
        'role_type', ur.role_type,
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'permissions', ur.permissions
    ) INTO primary_role
    FROM user_roles ur
    WHERE ur.user_id = user_id
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;
    
    RETURN primary_role;
END;
$$;

-- Function to check if user has specific permission (no recursion)
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id uuid, permission_name text)
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
    WHERE ur.user_id = user_id
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;
    
    -- Check if permission exists
    IF user_permissions IS NOT NULL THEN
        has_permission := (user_permissions ->> permission_name)::boolean = true;
    END IF;
    
    -- Platform admins have all permissions
    IF NOT has_permission THEN
        SELECT public.is_platform_admin(user_id) INTO has_permission;
    END IF;
    
    RETURN has_permission;
END;
$$;

-- Function to get user's organization context (no recursion)
CREATE OR REPLACE FUNCTION public.get_user_organization_context(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_context jsonb;
BEGIN
    -- Get user's primary role organization context
    SELECT jsonb_build_object(
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'role_type', ur.role_type
    ) INTO org_context
    FROM user_roles ur
    WHERE ur.user_id = user_id
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;
    
    RETURN org_context;
END;
$$;

-- ============================================================================
-- STEP 2: CREATE HELPER FUNCTIONS FOR RLS POLICIES
-- ============================================================================

-- Function to check if user can access agency data
CREATE OR REPLACE FUNCTION public.can_access_agency(user_id uuid, agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    can_access boolean := false;
    user_context jsonb;
BEGIN
    -- Platform admins can access everything
    IF public.is_platform_admin(user_id) THEN
        RETURN true;
    END IF;
    
    -- Get user's organization context
    SELECT public.get_user_organization_context(user_id) INTO user_context;
    
    -- Agency admins and users can access their agency
    IF user_context->>'organization_type' = 'agency' THEN
        can_access := (user_context->>'organization_id')::uuid = agency_id;
    END IF;
    
    RETURN can_access;
END;
$$;

-- Function to check if user can access client data
CREATE OR REPLACE FUNCTION public.can_access_client(user_id uuid, client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    can_access boolean := false;
    user_context jsonb;
BEGIN
    -- Platform admins can access everything
    IF public.is_platform_admin(user_id) THEN
        RETURN true;
    END IF;
    
    -- Get user's organization context
    SELECT public.get_user_organization_context(user_id) INTO user_context;
    
    -- Client admins and users can access their client
    IF user_context->>'organization_type' = 'client' THEN
        can_access := (user_context->>'organization_id')::uuid = client_id;
    END IF;
    
    -- Agency users can access clients under their agency
    IF user_context->>'organization_type' = 'agency' THEN
        can_access := EXISTS(
            SELECT 1 FROM master_clients mc
            WHERE mc.id = client_id
            AND mc.agency_id = (user_context->>'organization_id')::uuid
        );
    END IF;
    
    RETURN can_access;
END;
$$;

-- Function to check if user can access portfolio data
CREATE OR REPLACE FUNCTION public.can_access_portfolio(user_id uuid, portfolio_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    can_access boolean := false;
    user_context jsonb;
BEGIN
    -- Platform admins can access everything
    IF public.is_platform_admin(user_id) THEN
        RETURN true;
    END IF;
    
    -- Get user's organization context
    SELECT public.get_user_organization_context(user_id) INTO user_context;
    
    -- Check portfolio access based on organization context
    IF user_context->>'organization_type' = 'agency' THEN
        can_access := EXISTS(
            SELECT 1 FROM portfolios p
            WHERE p.id = portfolio_id
            AND p.agency_id = (user_context->>'organization_id')::uuid
        );
    ELSIF user_context->>'organization_type' = 'client' THEN
        can_access := EXISTS(
            SELECT 1 FROM portfolios p
            WHERE p.id = portfolio_id
            AND p.client_id = (user_context->>'organization_id')::uuid
        );
    END IF;
    
    RETURN can_access;
END;
$$;

-- ============================================================================
-- STEP 3: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.is_platform_admin(uuid) IS 'Check if user is platform admin - no recursion, direct query';
COMMENT ON FUNCTION public.get_user_primary_role(uuid) IS 'Get user primary role - no recursion, direct query';
COMMENT ON FUNCTION public.user_has_permission(uuid, text) IS 'Check if user has specific permission - no recursion';
COMMENT ON FUNCTION public.get_user_organization_context(uuid) IS 'Get user organization context - no recursion';
COMMENT ON FUNCTION public.can_access_agency(uuid, uuid) IS 'Check if user can access agency data - no recursion';
COMMENT ON FUNCTION public.can_access_client(uuid, uuid) IS 'Check if user can access client data - no recursion';
COMMENT ON FUNCTION public.can_access_portfolio(uuid, uuid) IS 'Check if user can access portfolio data - no recursion';

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

-- Log the creation of new functions
DO $$
BEGIN
    RAISE NOTICE '=== CLEAN RLS PERMISSION FUNCTIONS CREATED ===';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - is_platform_admin(uuid)';
    RAISE NOTICE '  - get_user_primary_role(uuid)';
    RAISE NOTICE '  - user_has_permission(uuid, text)';
    RAISE NOTICE '  - get_user_organization_context(uuid)';
    RAISE NOTICE '  - can_access_agency(uuid, uuid)';
    RAISE NOTICE '  - can_access_client(uuid, uuid)';
    RAISE NOTICE '  - can_access_portfolio(uuid, uuid)';
    RAISE NOTICE 'All functions are non-recursive and use direct queries';
    RAISE NOTICE '========================================';
END $$;
