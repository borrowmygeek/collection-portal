-- Fix get_user_roles function to use correct column name for master_buyers
-- Run this in the Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_user_roles(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_roles jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', ur.id,
        'role_type', ur.role_type,
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'is_active', ur.is_active,
        'is_primary', ur.is_primary,
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
    )) INTO v_roles
    FROM user_roles ur
    WHERE ur.user_id = p_user_id
    AND ur.is_active = true;
    
    RETURN COALESCE(v_roles, '[]'::jsonb);
EXCEPTION
    WHEN undefined_table THEN
        -- If master tables don't exist, return roles with generic organization names
        SELECT jsonb_agg(jsonb_build_object(
            'id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
            'is_active', ur.is_active,
            'is_primary', ur.is_primary,
            'permissions', ur.permissions,
            'organization_name', 
            CASE ur.organization_type
                WHEN 'agency' THEN 'Agency ' || ur.organization_id
                WHEN 'client' THEN 'Client ' || ur.organization_id
                WHEN 'buyer' THEN 'Buyer ' || ur.organization_id
                ELSE 'Platform'
            END
        )) INTO v_roles
        FROM user_roles ur
        WHERE ur.user_id = p_user_id
        AND ur.is_active = true;
        
        RETURN COALESCE(v_roles, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_roles IS 'Returns all roles for a user with fallback organization names'; 