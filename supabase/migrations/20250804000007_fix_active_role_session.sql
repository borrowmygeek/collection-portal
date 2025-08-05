-- Fix get_user_active_role to properly handle role session tokens
-- This version accepts an optional session token parameter

-- First, drop any existing function definitions to avoid conflicts
DROP FUNCTION IF EXISTS get_user_active_role(uuid);
DROP FUNCTION IF EXISTS get_user_active_role(uuid, text);

-- Create the new function with the updated signature
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
        ) INTO v_active_role
        FROM user_roles ur
        JOIN user_role_sessions urs ON ur.id = urs.role_id
        WHERE urs.session_token = v_session_token
        AND urs.expires_at > now()
        AND ur.is_active = true;
    END IF;
    
    -- If no session or session expired, get highest privilege role
    IF v_active_role IS NULL THEN
        v_active_role := get_user_highest_role(p_user_id);
    END IF;
    
    RETURN v_active_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_user_active_role(uuid, text) IS 'Returns the user''s currently active role, considering role session tokens'; 