-- Ultra-fast user role functions - simplified to avoid any complex queries
-- This migration replaces the slow functions with extremely fast ones

-- Drop the problematic functions
DROP FUNCTION IF EXISTS get_user_active_role(uuid, text);
DROP FUNCTION IF EXISTS get_user_roles_simple(uuid);

-- Create ultra-fast version of get_user_roles_simple
CREATE OR REPLACE FUNCTION get_user_roles_simple(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_roles jsonb;
BEGIN
    -- Simple, direct query with no joins or subqueries
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'client' THEN 'Client ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'buyer' THEN 'Buyer'
                ELSE 'Platform'
            END,
            'is_primary', ur.is_primary,
            'is_active', ur.is_active,
            'permissions', ur.permissions
        )
    ) INTO v_roles
    FROM user_roles ur
    WHERE ur.user_id = p_user_id
    AND ur.is_active = true;
    
    RETURN COALESCE(v_roles, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create ultra-fast version of get_user_active_role
CREATE OR REPLACE FUNCTION get_user_active_role(p_user_id uuid DEFAULT auth.uid(), p_session_token text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    v_active_role jsonb;
BEGIN
    -- If session token provided, get role from session (fast lookup)
    IF p_session_token IS NOT NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'client' THEN 'Client ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'buyer' THEN 'Buyer'
                ELSE 'Platform'
            END,
            'permissions', ur.permissions
        ) INTO v_active_role
        FROM user_roles ur
        JOIN user_role_sessions urs ON ur.id = urs.role_id
        WHERE urs.session_token = p_session_token
        AND urs.expires_at > now()
        AND ur.is_active = true
        LIMIT 1;
    END IF;
    
    -- If no session or session expired, get primary role (fast lookup)
    IF v_active_role IS NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'client' THEN 'Client ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'buyer' THEN 'Buyer'
                ELSE 'Platform'
            END,
            'permissions', ur.permissions
        ) INTO v_active_role
        FROM user_roles ur
        WHERE ur.user_id = p_user_id
        AND ur.is_active = true
        AND ur.is_primary = true
        LIMIT 1;
    END IF;
    
    -- If still no role, get first active role (fast lookup)
    IF v_active_role IS NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'client' THEN 'Client ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'buyer' THEN 'Buyer'
                ELSE 'Platform'
            END,
            'permissions', ur.permissions
        ) INTO v_active_role
        FROM user_roles ur
        WHERE ur.user_id = p_user_id
        AND ur.is_active = true
        ORDER BY 
            CASE ur.role_type
                WHEN 'platform_admin' THEN 1
                WHEN 'agency_admin' THEN 2
                WHEN 'agency_user' THEN 3
                WHEN 'client_admin' THEN 4
                WHEN 'client_user' THEN 5
                WHEN 'buyer' THEN 6
                ELSE 7
            END
        LIMIT 1;
    END IF;
    
    RETURN v_active_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes to speed up the queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_active ON user_roles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_primary ON user_roles(user_id, is_primary, is_active);
CREATE INDEX IF NOT EXISTS idx_user_role_sessions_token_expires ON user_role_sessions(session_token, expires_at);

-- Add comments
COMMENT ON FUNCTION get_user_roles_simple(uuid) IS 'Ultra-fast version with no complex queries or joins';
COMMENT ON FUNCTION get_user_active_role(uuid, text) IS 'Ultra-fast version with no complex queries or joins';
