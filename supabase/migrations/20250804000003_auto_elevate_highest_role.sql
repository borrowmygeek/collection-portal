-- Migration: Auto-Elevate to Highest Role on Login
-- Created: 2025-08-04

-- ============================================================================
-- ROLE PRIORITY FUNCTION
-- ============================================================================

-- Function to get the highest privilege role for a user
CREATE OR REPLACE FUNCTION get_user_highest_role(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_highest_role jsonb;
    v_agency_name text;
    v_client_name text;
    v_buyer_name text;
BEGIN
    -- Get the highest privilege role based on role hierarchy
    -- Priority: platform_admin > agency_admin > agency_user > client_admin > client_user > buyer
    SELECT jsonb_build_object(
        'role_id', ur.id,
        'role_type', ur.role_type,
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'permissions', ur.permissions,
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
        END
    ) INTO v_highest_role
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
    
    RETURN v_highest_role;
EXCEPTION
    WHEN undefined_table THEN
        -- If master tables don't exist, return role with generic organization name
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'permissions', ur.permissions,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || ur.organization_id
                WHEN 'client' THEN 'Client ' || ur.organization_id
                WHEN 'buyer' THEN 'Buyer ' || ur.organization_id
                ELSE 'Platform'
            END
        ) INTO v_highest_role
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
        
        RETURN v_highest_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE EXISTING FUNCTION
-- ============================================================================

-- Update get_user_active_role to use highest role by default instead of primary role
CREATE OR REPLACE FUNCTION get_user_active_role(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_active_role jsonb;
    v_session_token text;
BEGIN
    -- Get session token from request headers (if available)
    v_session_token := current_setting('request.headers', true)::jsonb->>'x-role-session-token';
    
    -- If session token provided, get role from session
    IF v_session_token IS NOT NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'permissions', ur.permissions
        ) INTO v_active_role
        FROM user_roles ur
        JOIN user_role_sessions urs ON ur.id = urs.role_id
        WHERE urs.session_token = v_session_token
        AND urs.expires_at > now()
        AND ur.is_active = true;
    END IF;
    
    -- If no session or session expired, get highest privilege role instead of primary role
    IF v_active_role IS NULL THEN
        v_active_role := get_user_highest_role(p_user_id);
    END IF;
    
    RETURN v_active_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 