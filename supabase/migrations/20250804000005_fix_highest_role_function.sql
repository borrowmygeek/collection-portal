-- Migration: Fix Highest Role Function - Direct Fix
-- Created: 2025-08-04

-- ============================================================================
-- DIRECT FUNCTION FIX
-- ============================================================================

-- Drop and recreate the function to ensure it's completely updated
DROP FUNCTION IF EXISTS get_user_highest_role(uuid);

-- Function to get the highest privilege role for a user
CREATE OR REPLACE FUNCTION get_user_highest_role(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_highest_role jsonb;
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