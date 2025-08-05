-- Add server-side version of create_role_session function
-- This version accepts a user_id parameter for server-side calls

CREATE OR REPLACE FUNCTION create_role_session_server(
    p_user_id uuid,
    p_role_id uuid,
    p_session_duration_hours integer DEFAULT 24
)
RETURNS text AS $$
DECLARE
    v_session_token text;
    v_role_user_id uuid;
BEGIN
    -- Get user_id from role and verify it matches the provided user_id
    SELECT user_id INTO v_role_user_id
    FROM user_roles
    WHERE id = p_role_id
    AND user_id = p_user_id
    AND is_active = true;
    
    IF v_role_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid role or insufficient permissions';
    END IF;
    
    -- Generate session token
    v_session_token := encode(gen_random_bytes(32), 'hex');
    
    -- Create session
    INSERT INTO user_role_sessions (
        user_id,
        role_id,
        session_token,
        expires_at
    ) VALUES (
        p_user_id,
        p_role_id,
        v_session_token,
        now() + (p_session_duration_hours || ' hours')::interval
    );
    
    RETURN v_session_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION create_role_session_server IS 'Server-side version of create_role_session that accepts user_id parameter'; 