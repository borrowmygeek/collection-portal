-- ============================================================================
-- FIX PERMISSION FUNCTIONS TO WORK WITH AUTH_USER_ID
-- This migration fixes the permission functions to work correctly
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_platform_admin(user_id uuid);
DROP FUNCTION IF EXISTS public.user_has_permission(user_id uuid, permission_name text);

-- ============================================================================
-- STEP 2: CREATE FIXED PLATFORM ADMIN CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(auth_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean := false;
BEGIN
    -- Check if user has platform_admin role by looking up the platform_users.id first
    SELECT EXISTS(
        SELECT 1 FROM user_roles ur
        JOIN platform_users pu ON ur.user_id = pu.id
        WHERE pu.auth_user_id = is_platform_admin.auth_user_id
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    ) INTO is_admin;
    
    RETURN is_admin;
END;
$$;

-- ============================================================================
-- STEP 3: CREATE FIXED USER HAS PERMISSION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_permission(auth_user_id uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_permission boolean := false;
    user_permissions jsonb;
BEGIN
    -- Get user's primary role permissions by looking up the platform_users.id first
    SELECT ur.permissions INTO user_permissions
    FROM user_roles ur
    JOIN platform_users pu ON ur.user_id = pu.id
    WHERE pu.auth_user_id = user_has_permission.auth_user_id
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
            JOIN platform_users pu ON ur.user_id = pu.id
            WHERE pu.auth_user_id = user_has_permission.auth_user_id
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        ) INTO has_permission;
    END IF;

    RETURN has_permission;
END;
$$;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== PERMISSION FUNCTIONS FIXED ===';
    RAISE NOTICE 'Functions updated to work with auth_user_id:';
    RAISE NOTICE '  - is_platform_admin(auth_user_id uuid)';
    RAISE NOTICE '  - user_has_permission(auth_user_id uuid, text)';
    RAISE NOTICE 'API routes should now work properly';
    RAISE NOTICE '=======================================';
END $$;
