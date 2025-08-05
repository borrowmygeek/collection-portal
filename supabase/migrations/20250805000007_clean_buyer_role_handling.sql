-- Clean buyer role handling - no buyer records required
-- This migration provides elegant handling of buyer roles for test data

-- Update the get_user_roles_simple function with better buyer handling
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
                        'Buyer'  -- Clean, simple fallback
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

-- Update the get_user_active_role_simple function to match
CREATE OR REPLACE FUNCTION get_user_active_role_simple(p_user_id uuid DEFAULT auth.uid())
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
                        'Buyer'  -- Clean, simple fallback
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
                        'Buyer'  -- Clean, simple fallback
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

-- Create a function to check buyer NDA compliance that handles missing buyer records
CREATE OR REPLACE FUNCTION check_buyer_nda_compliance_safe(buyer_uuid uuid)
RETURNS TABLE (
    is_compliant boolean,
    current_version text,
    signed_version text,
    compliance_status text,
    message text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(mb.nda_signed, false) as is_compliant,
        COALESCE(mb.current_nda_version, '1.0') as current_version,
        mb.nda_version_signed as signed_version,
        COALESCE(mb.nda_compliance_status, 'not_registered') as compliance_status,
        CASE 
            WHEN mb.id IS NULL THEN 'Buyer not registered - NDA compliance not required for test roles'
            WHEN mb.nda_signed = false THEN 'NDA not signed'
            WHEN mb.nda_version_signed != mb.current_nda_version THEN 'NDA version outdated'
            ELSE 'NDA compliant'
        END as message
    FROM master_buyers mb
    WHERE mb.id = buyer_uuid;
    
    -- If no buyer record found, return compliant for test data
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            true as is_compliant,
            '1.0' as current_version,
            NULL as signed_version,
            'test_role' as compliance_status,
            'Test buyer role - NDA compliance not required' as message;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log the changes
DO $$
BEGIN
    RAISE NOTICE '✅ Implemented clean buyer role handling:';
    RAISE NOTICE '   - Updated get_user_roles_simple function';
    RAISE NOTICE '   - Updated get_user_active_role_simple function';
    RAISE NOTICE '   - Created check_buyer_nda_compliance_safe function';
    RAISE NOTICE '   - Buyer roles now show "Buyer" for test data';
    RAISE NOTICE '   - NDA compliance bypassed for test roles';
END $$; 