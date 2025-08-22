-- ============================================================================
-- ADD MISSING FUNCTIONS
-- This migration adds the functions that weren't created in previous migrations
-- ============================================================================

-- Add user_has_permission function
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
        SELECT public.is_platform_admin(user_id) INTO has_permission;
    END IF;

    RETURN has_permission;
END;
$$;

-- Add switch_user_role function
CREATE OR REPLACE FUNCTION public.switch_user_role(user_id uuid, role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_role jsonb;
    session_token text;
BEGIN
    -- Verify the role belongs to the user and is active
    SELECT jsonb_build_object(
        'id', ur.id,
        'role_type', ur.role_type,
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'permissions', ur.permissions
    ) INTO new_role
    FROM user_roles ur
    WHERE ur.id = role_id
    AND ur.user_id = switch_user_role.user_id
    AND ur.is_active = true;

    IF new_role IS NULL THEN
        RAISE EXCEPTION 'Invalid role or role not found';
    END IF;

    -- Generate session token
    session_token := encode(gen_random_bytes(32), 'hex');

    -- Create or update session
    INSERT INTO user_role_sessions (user_id, role_id, session_token, expires_at)
    VALUES (user_id, role_id, session_token, now() + interval '24 hours')
    ON CONFLICT (user_id)
    DO UPDATE SET
        role_id = EXCLUDED.role_id,
        session_token = EXCLUDED.session_token,
        expires_at = EXCLUDED.expires_at;

    -- Return the new role and session info
    RETURN jsonb_build_object(
        'role', new_role,
        'session_token', session_token,
        'expires_at', now() + interval '24 hours'
    );
END;
$$;

-- Add get_current_session_role function
CREATE OR REPLACE FUNCTION public.get_current_session_role(session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_role jsonb;
BEGIN
    -- Get current role from session
    SELECT jsonb_build_object(
        'role_id', ur.id,
        'role_type', ur.role_type,
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'permissions', ur.permissions,
        'session_id', urs.id,
        'expires_at', urs.expires_at
    ) INTO current_role
    FROM user_role_sessions urs
    JOIN user_roles ur ON ur.id = urs.role_id
    WHERE urs.session_token = get_current_session_role.session_token
    AND urs.expires_at > now()
    AND ur.is_active = true;

    RETURN current_role;
END;
$$;

-- Add is_user_authenticated function
CREATE OR REPLACE FUNCTION public.is_user_authenticated(auth_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_authenticated boolean := false;
BEGIN
    -- Check if user exists and is active
    SELECT EXISTS(
        SELECT 1 FROM platform_users pu
        WHERE pu.auth_user_id = is_user_authenticated.auth_user_id
        AND pu.status = 'active'
    ) INTO is_authenticated;

    RETURN is_authenticated;
END;
$$;

-- Add comments
COMMENT ON FUNCTION public.user_has_permission(uuid, text) IS 'Check if user has specific permission - no recursion';
COMMENT ON FUNCTION public.switch_user_role(uuid, uuid) IS 'Switch user role and create session - no recursion';
COMMENT ON FUNCTION public.get_current_session_role(text) IS 'Get current role from session - no recursion';
COMMENT ON FUNCTION public.is_user_authenticated(uuid) IS 'Check if user is authenticated - no recursion';

-- Log the creation
DO $$
BEGIN
    RAISE NOTICE '=== MISSING FUNCTIONS ADDED ===';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - user_has_permission(uuid, text)';
    RAISE NOTICE '  - switch_user_role(uuid, uuid)';
    RAISE NOTICE '  - get_current_session_role(text)';
    RAISE NOTICE '  - is_user_authenticated(uuid)';
    RAISE NOTICE 'All missing functions have been added';
    RAISE NOTICE '========================================';
END $$;
