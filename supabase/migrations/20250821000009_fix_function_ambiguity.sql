-- ============================================================================
-- FIX FUNCTION AMBIGUITY ISSUES
-- This migration fixes ambiguous column references in permission functions
-- ============================================================================

-- Fix is_platform_admin function
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
        WHERE ur.user_id = is_platform_admin.user_id
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    ) INTO is_admin;

    RETURN is_admin;
END;
$$;

-- Fix get_user_primary_role function
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
    WHERE ur.user_id = get_user_primary_role.user_id
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;

    RETURN primary_role;
END;
$$;

-- Fix get_user_organization_context function
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
    WHERE ur.user_id = get_user_organization_context.user_id
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;

    RETURN org_context;
END;
$$;

-- Fix get_user_effective_permissions function
CREATE OR REPLACE FUNCTION public.get_user_effective_permissions(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    effective_permissions jsonb := '{}'::jsonb;
    primary_role_permissions jsonb;
    is_platform_admin boolean;
BEGIN
    -- Get platform admin status
    SELECT public.is_platform_admin(user_id) INTO is_platform_admin;

    -- Platform admins have all permissions
    IF is_platform_admin THEN
        RETURN jsonb_build_object(
            'can_manage_users', true,
            'can_manage_roles', true,
            'can_view_all_data', true,
            'can_manage_system', true,
            'can_access_audit_logs', true
        );
    END IF;

    -- Get primary role permissions
    SELECT ur.permissions INTO primary_role_permissions
    FROM user_roles ur
    WHERE ur.user_id = get_user_effective_permissions.user_id
    AND ur.is_active = true
    AND ur.is_primary = true
    LIMIT 1;

    -- Return effective permissions
    RETURN COALESCE(primary_role_permissions, '{}'::jsonb);
END;
$$;

-- Fix can_access_agency function
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

-- Fix can_access_client function
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

-- Add comments
COMMENT ON FUNCTION public.is_platform_admin(uuid) IS 'Check if user is platform admin - fixed ambiguous column reference';
COMMENT ON FUNCTION public.get_user_primary_role(uuid) IS 'Get user primary role - fixed ambiguous column reference';
COMMENT ON FUNCTION public.get_user_organization_context(uuid) IS 'Get user organization context - fixed ambiguous column reference';
COMMENT ON FUNCTION public.get_user_effective_permissions(uuid) IS 'Get user effective permissions - fixed ambiguous column reference';
COMMENT ON FUNCTION public.can_access_agency(uuid, uuid) IS 'Check if user can access agency data - fixed ambiguous column reference';
COMMENT ON FUNCTION public.can_access_client(uuid, uuid) IS 'Check if user can access client data - fixed ambiguous column reference';

-- Log the fixes
DO $$
BEGIN
    RAISE NOTICE '=== FUNCTION AMBIGUITY ISSUES FIXED ===';
    RAISE NOTICE 'Fixed functions:';
    RAISE NOTICE '  - is_platform_admin(uuid)';
    RAISE NOTICE '  - get_user_primary_role(uuid)';
    RAISE NOTICE '  - get_user_organization_context(uuid)';
    RAISE NOTICE '  - get_user_effective_permissions(uuid)';
    RAISE NOTICE '  - can_access_agency(uuid, uuid)';
    RAISE NOTICE '  - can_access_client(uuid, uuid)';
    RAISE NOTICE 'All ambiguous column references have been resolved';
    RAISE NOTICE '========================================';
END $$;
