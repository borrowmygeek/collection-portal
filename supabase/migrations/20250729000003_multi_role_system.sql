-- Migration: Multi-Role System Implementation
-- Created: 2025-07-29

-- ============================================================================
-- USER ROLES TABLE
-- ============================================================================

-- Create user_roles table to support multiple roles per user
CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES platform_users(id) ON DELETE CASCADE,
    role_type text NOT NULL CHECK (role_type IN (
        'platform_admin',
        'agency_admin', 
        'agency_user',
        'client_admin',
        'client_user',
        'buyer'
    )),
    organization_type text NOT NULL CHECK (organization_type IN (
        'platform',
        'agency',
        'client',
        'buyer'
    )),
    organization_id uuid, -- References the specific organization (agency_id, client_id, etc.)
    is_active boolean DEFAULT true,
    is_primary boolean DEFAULT false, -- Only one primary role per user
    permissions jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure only one primary role per user
    CONSTRAINT unique_primary_role UNIQUE (user_id, is_primary) DEFERRABLE INITIALLY DEFERRED,
    
    -- Ensure unique role per organization per user
    CONSTRAINT unique_user_org_role UNIQUE (user_id, organization_type, organization_id, role_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization ON user_roles(organization_type, organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_primary ON user_roles(is_primary);

-- ============================================================================
-- ROLE SESSION TABLE
-- ============================================================================

-- Create user_role_sessions table to track active role sessions
CREATE TABLE IF NOT EXISTS user_role_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES platform_users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES user_roles(id) ON DELETE CASCADE,
    session_token text UNIQUE NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    last_activity_at timestamptz DEFAULT now()
);

-- Create indexes for session management
CREATE INDEX IF NOT EXISTS idx_user_role_sessions_user_id ON user_role_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_sessions_token ON user_role_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_role_sessions_expires ON user_role_sessions(expires_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get user's current active role
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
    
    -- If no session or session expired, get primary role
    IF v_active_role IS NULL THEN
        SELECT jsonb_build_object(
            'role_id', ur.id,
            'role_type', ur.role_type,
            'organization_type', ur.organization_type,
            'organization_id', ur.organization_id,
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

-- Function to get all user roles
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb AS $$
DECLARE
    v_roles jsonb;
    v_agency_name text;
    v_client_name text;
    v_buyer_name text;
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

-- Function to create a role session
CREATE OR REPLACE FUNCTION create_role_session(
    p_role_id uuid,
    p_session_duration_hours integer DEFAULT 24
)
RETURNS text AS $$
DECLARE
    v_session_token text;
    v_user_id uuid;
BEGIN
    -- Get user_id from role
    SELECT user_id INTO v_user_id
    FROM user_roles
    WHERE id = p_role_id
    AND user_id = auth.uid()
    AND is_active = true;
    
    IF v_user_id IS NULL THEN
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
        v_user_id,
        p_role_id,
        v_session_token,
        now() + (p_session_duration_hours || ' hours')::interval
    );
    
    RETURN v_session_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate role session
CREATE OR REPLACE FUNCTION validate_role_session(p_session_token text)
RETURNS jsonb AS $$
DECLARE
    v_session_data jsonb;
BEGIN
    SELECT jsonb_build_object(
        'valid', true,
        'role_id', ur.id,
        'role_type', ur.role_type,
        'organization_type', ur.organization_type,
        'organization_id', ur.organization_id,
        'permissions', ur.permissions
    ) INTO v_session_data
    FROM user_role_sessions urs
    JOIN user_roles ur ON urs.role_id = ur.id
    WHERE urs.session_token = p_session_token
    AND urs.expires_at > now()
    AND ur.is_active = true;
    
    RETURN COALESCE(v_session_data, '{"valid": false}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    DELETE FROM user_role_sessions
    WHERE expires_at < now();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to ensure only one primary role per user
CREATE OR REPLACE FUNCTION ensure_single_primary_role()
RETURNS trigger AS $$
BEGIN
    -- If this is being set as primary, unset all other primary roles for this user
    IF NEW.is_primary = true THEN
        UPDATE user_roles 
        SET is_primary = false 
        WHERE user_id = NEW.user_id 
        AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_primary_role ON user_roles;
CREATE TRIGGER trigger_ensure_single_primary_role
    BEFORE INSERT OR UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION ensure_single_primary_role();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_roles_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_user_roles_updated_at ON user_roles;
CREATE TRIGGER trigger_update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION update_user_roles_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

-- Platform admins can manage all roles
CREATE POLICY "Platform admins can manage all roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        )
    );

-- Agency admins can manage roles within their agency
CREATE POLICY "Agency admins can manage agency roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role_type = 'agency_admin'
            AND ur.organization_type = 'agency'
            AND ur.organization_id = user_roles.organization_id
            AND ur.is_active = true
        )
    );

-- Enable RLS on user_role_sessions
ALTER TABLE user_role_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON user_role_sessions
    FOR SELECT USING (user_id = auth.uid());

-- Users can manage their own sessions
CREATE POLICY "Users can manage own sessions" ON user_role_sessions
    FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- MIGRATION OF EXISTING DATA
-- ============================================================================

-- Migrate existing platform_users roles to user_roles table
INSERT INTO user_roles (user_id, role_type, organization_type, organization_id, is_primary, is_active)
SELECT 
    id as user_id,
    COALESCE(role, 'platform_user') as role_type,
    CASE 
        WHEN role LIKE 'agency_%' THEN 'agency'
        WHEN role LIKE 'client_%' THEN 'client'
        ELSE 'platform'
    END as organization_type,
    CASE 
        WHEN role LIKE 'agency_%' THEN agency_id
        ELSE NULL
    END as organization_id,
    true as is_primary,
    COALESCE(status = 'active', true) as is_active
FROM platform_users
WHERE id NOT IN (SELECT user_id FROM user_roles);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_roles IS 'Stores user roles across different organizations';
COMMENT ON COLUMN user_roles.role_type IS 'Type of role (platform_admin, agency_admin, etc.)';
COMMENT ON COLUMN user_roles.organization_type IS 'Type of organization (platform, agency, client, buyer)';
COMMENT ON COLUMN user_roles.organization_id IS 'ID of the specific organization';
COMMENT ON COLUMN user_roles.is_primary IS 'Whether this is the user''s primary role';
COMMENT ON COLUMN user_roles.permissions IS 'JSON object containing role-specific permissions';

COMMENT ON TABLE user_role_sessions IS 'Tracks active role sessions for users';
COMMENT ON COLUMN user_role_sessions.session_token IS 'Unique token for the role session';
COMMENT ON COLUMN user_role_sessions.expires_at IS 'When the session expires';

COMMENT ON FUNCTION get_user_active_role IS 'Returns the user''s currently active role';
COMMENT ON FUNCTION get_user_roles IS 'Returns all roles for a user';
COMMENT ON FUNCTION create_role_session IS 'Creates a new role session for a user';
COMMENT ON FUNCTION validate_role_session IS 'Validates a role session token';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Removes expired role sessions'; 