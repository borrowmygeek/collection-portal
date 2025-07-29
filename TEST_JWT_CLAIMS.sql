-- Test JWT Claims Function with Specific User ID
-- This helps debug the authentication system

-- Create a helper function to test claims for a specific user
CREATE OR REPLACE FUNCTION public.get_user_claims_for_user(user_uuid uuid)
RETURNS jsonb AS $$
DECLARE
    v_user platform_users%ROWTYPE;
    v_claims jsonb;
BEGIN
    -- Get user from platform_users table
    SELECT * INTO v_user 
    FROM platform_users 
    WHERE auth_user_id = user_uuid;
    
    IF NOT FOUND THEN
        -- Return basic claims for unregistered users
        RETURN jsonb_build_object(
            'role', 'unregistered',
            'user_id', user_uuid,
            'message', 'User not found in platform_users table'
        );
    END IF;
    
    -- Build claims for authenticated users
    v_claims := jsonb_build_object(
        'role', v_user.role,
        'email', v_user.email,
        'full_name', v_user.full_name,
        'agency_id', v_user.agency_id,
        'permissions', v_user.permissions,
        'status', v_user.status,
        'user_id', v_user.auth_user_id
    );
    
    RETURN v_claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage: Replace 'YOUR_USER_ID_HERE' with the actual user ID from the debug script
-- SELECT public.get_user_claims_for_user('YOUR_USER_ID_HERE'); 