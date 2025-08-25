-- ============================================================================
-- ADD MISSING PERMISSION FUNCTIONS
-- This migration adds the permission checking functions that API routes need
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE PLATFORM ADMIN CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean := false;
BEGIN
    -- Check if user has platform_admin role
    SELECT EXISTS(
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = is_platform_admin.user_id
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    ) INTO is_admin;
    
    RETURN is_admin;
END;
$$;

-- ============================================================================
-- STEP 2: CREATE USER HAS PERMISSION FUNCTION
-- ============================================================================

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
    WHERE ur.user_id = user_has_permission.user_id
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
            WHERE ur.user_id = user_has_permission.user_id
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        ) INTO has_permission;
    END IF;

    RETURN has_permission;
END;
$$;

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== PERMISSION FUNCTIONS ADDED ===';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - is_platform_admin(uuid)';
    RAISE NOTICE '  - user_has_permission(uuid, text)';
    RAISE NOTICE 'API routes should now work properly';
    RAISE NOTICE '=======================================';
END $$;
