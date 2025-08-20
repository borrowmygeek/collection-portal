-- Fix Database Function Timeout Issue
-- The get_user_active_role function is timing out due to complex subqueries to master tables
-- This creates a fast, simplified version that avoids the timeout

-- Drop the problematic function
DROP FUNCTION IF EXISTS get_user_active_role(uuid);
DROP FUNCTION IF EXISTS get_user_active_role(uuid, text);

-- Create a fast, simplified version that doesn't query master tables
CREATE OR REPLACE FUNCTION get_user_active_role(
    p_user_id uuid DEFAULT auth.uid(),
    p_session_token text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_active_role jsonb;
    v_session_token text;
BEGIN
    -- Use provided session token or try to get from headers
    v_session_token := COALESCE(
        p_session_token,
        current_setting('request.headers', true)::jsonb->>'x-role-session-token'
    );
    
    -- If session token provided, get role from session
    IF v_session_token IS NOT NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'permissions', ur.permissions,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'client' THEN 'Client ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'buyer' THEN 'Buyer ' || COALESCE(ur.organization_id::text, 'Unknown')
                ELSE 'Platform'
            END
        ) INTO v_active_role
        FROM user_roles ur
        JOIN user_role_sessions urs ON ur.id = urs.role_id
        WHERE urs.session_token = v_session_token
        AND urs.expires_at > now()
        AND ur.is_active = true;
    END IF;
    
    -- If no session or session expired, get the first active role (fast fallback)
    IF v_active_role IS NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'permissions', ur.permissions,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'client' THEN 'Client ' || COALESCE(ur.organization_id::text, 'Unknown')
                WHEN 'buyer' THEN 'Buyer ' || COALESCE(ur.organization_id::text, 'Unknown')
                ELSE 'Platform'
            END
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

-- Add comment
COMMENT ON FUNCTION get_user_active_role(uuid, text) IS 'Fast version that avoids master table queries to prevent timeouts';
