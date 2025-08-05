-- Fix RLS Policies to work with user_roles table
-- This migration fixes the security model to properly use the user_roles table

-- ============================================================================
-- FIX RLS POLICIES FOR PLATFORM_USERS TABLE
-- ============================================================================

-- Enable RLS on platform_users if not already enabled
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON platform_users;
DROP POLICY IF EXISTS "Platform admins can view all users" ON platform_users;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON platform_users FOR SELECT USING (
    auth_user_id = auth.uid()
);

-- Platform admins can view all users
CREATE POLICY "Platform admins can view all users" ON platform_users FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = platform_users.id
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    )
);

-- ============================================================================
-- SIMPLIFIED ROLE FUNCTIONS
-- ============================================================================

-- Simplified get_user_active_role function
CREATE OR REPLACE FUNCTION get_user_active_role_simple(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_active_role jsonb;
    v_session_token text;
BEGIN
    -- Get session token from request headers
    v_session_token := current_setting('request.headers', true)::jsonb->>'x-role-session-token';
    
    -- If session token provided, get role from session
    IF v_session_token IS NOT NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 
                    COALESCE(
                        (SELECT name FROM master_agencies WHERE id = ur.organization_id),
                        'Agency ' || ur.organization_id
                    )
                WHEN 'client' THEN 
                    COALESCE(
                        (SELECT name FROM master_clients WHERE id = ur.organization_id),
                        'Client ' || ur.organization_id
                    )
                WHEN 'buyer' THEN 
                    COALESCE(
                        (SELECT company_name FROM master_buyers WHERE id = ur.organization_id),
                        'Buyer ' || ur.organization_id
                    )
                ELSE 'Platform'
            END,
            'permissions', ur.permissions
        ) INTO v_active_role
        FROM user_roles ur
        JOIN user_role_sessions urs ON ur.id = urs.role_id
        WHERE urs.session_token = v_session_token
        AND urs.expires_at > now()
        AND ur.is_active = true;
    END IF;
    
    -- If no session or session expired, get primary role
    IF v_active_role IS NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 
                    COALESCE(
                        (SELECT name FROM master_agencies WHERE id = ur.organization_id),
                        'Agency ' || ur.organization_id
                    )
                WHEN 'client' THEN 
                    COALESCE(
                        (SELECT name FROM master_clients WHERE id = ur.organization_id),
                        'Client ' || ur.organization_id
                    )
                WHEN 'buyer' THEN 
                    COALESCE(
                        (SELECT company_name FROM master_buyers WHERE id = ur.organization_id),
                        'Buyer ' || ur.organization_id
                    )
                ELSE 'Platform'
            END,
            'permissions', ur.permissions
        ) INTO v_active_role
        FROM user_roles ur
        WHERE ur.user_id = p_user_id
        AND ur.is_primary = true
        AND ur.is_active = true;
    END IF;
    
    RETURN v_active_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simplified get_user_roles function
CREATE OR REPLACE FUNCTION get_user_roles_simple(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_roles jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 
                    COALESCE(
                        (SELECT name FROM master_agencies WHERE id = ur.organization_id),
                        'Agency ' || ur.organization_id
                    )
                WHEN 'client' THEN 
                    COALESCE(
                        (SELECT name FROM master_clients WHERE id = ur.organization_id),
                        'Client ' || ur.organization_id
                    )
                WHEN 'buyer' THEN 
                    COALESCE(
                        (SELECT company_name FROM master_buyers WHERE id = ur.organization_id),
                        'Buyer ' || ur.organization_id
                    )
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

-- Add comments
COMMENT ON FUNCTION get_user_active_role_simple IS 'Simplified function to get user active role with organization names';
COMMENT ON FUNCTION get_user_roles_simple IS 'Simplified function to get all user roles with organization names'; 