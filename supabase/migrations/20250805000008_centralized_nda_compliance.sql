-- Centralized NDA Compliance System for Multi-Role System
-- This migration creates a unified NDA compliance tracking system

-- ============================================================================
-- NDA COMPLIANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_nda_compliance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
    
    -- NDA Information
    nda_version text NOT NULL,
    nda_signed_at timestamptz NOT NULL DEFAULT now(),
    nda_signed_by uuid REFERENCES platform_users(id), -- Who witnessed/signed
    
    -- Compliance Status
    is_compliant boolean DEFAULT true,
    compliance_status text DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'non_compliant', 'expired', 'pending')),
    
    -- Document Tracking
    document_hash text, -- Hash of the signed document for verification
    ip_address inet, -- IP address when signed
    user_agent text, -- Browser/device info
    
    -- Metadata
    notes text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_nda_compliance_user_id ON user_nda_compliance(user_id);
CREATE INDEX IF NOT EXISTS idx_user_nda_compliance_version ON user_nda_compliance(nda_version);
CREATE INDEX IF NOT EXISTS idx_user_nda_compliance_status ON user_nda_compliance(compliance_status);
CREATE INDEX IF NOT EXISTS idx_user_nda_compliance_signed_at ON user_nda_compliance(nda_signed_at);

-- ============================================================================
-- NDA VERSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS nda_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version text UNIQUE NOT NULL,
    title text NOT NULL,
    description text,
    
    -- Document Content
    document_content text NOT NULL, -- Full NDA text
    document_hash text NOT NULL, -- Hash of document content
    
    -- Version Control
    is_active boolean DEFAULT false,
    effective_date timestamptz NOT NULL,
    expiration_date timestamptz, -- NULL means no expiration
    
    -- Metadata
    created_by uuid REFERENCES platform_users(id),
    change_notes text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nda_versions_active ON nda_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_nda_versions_effective_date ON nda_versions(effective_date);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get current active NDA version
CREATE OR REPLACE FUNCTION get_current_nda_version()
RETURNS text AS $$
DECLARE
    v_version text;
BEGIN
    SELECT version INTO v_version
    FROM nda_versions
    WHERE is_active = true
    AND effective_date <= now()
    AND (expiration_date IS NULL OR expiration_date > now())
    ORDER BY effective_date DESC
    LIMIT 1;
    
    RETURN COALESCE(v_version, '1.0'); -- Default fallback
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is NDA compliant
CREATE OR REPLACE FUNCTION check_user_nda_compliance(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
    is_compliant boolean,
    current_version text,
    user_version text,
    signed_at timestamptz,
    compliance_status text,
    message text
) AS $$
DECLARE
    v_current_version text;
    v_user_compliance user_nda_compliance%ROWTYPE;
BEGIN
    -- Get current active NDA version
    v_current_version := get_current_nda_version();
    
    -- Get user's NDA compliance record
    SELECT * INTO v_user_compliance
    FROM user_nda_compliance
    WHERE user_id = p_user_id
    ORDER BY nda_signed_at DESC
    LIMIT 1;
    
    -- If no compliance record found
    IF v_user_compliance IS NULL THEN
        RETURN QUERY
        SELECT 
            false as is_compliant,
            v_current_version as current_version,
            NULL as user_version,
            NULL as signed_at,
            'not_signed' as compliance_status,
            'NDA not signed - access to sales information restricted' as message;
        RETURN;
    END IF;
    
    -- Check if user's version matches current version
    IF v_user_compliance.nda_version != v_current_version THEN
        RETURN QUERY
        SELECT 
            false as is_compliant,
            v_current_version as current_version,
            v_user_compliance.nda_version as user_version,
            v_user_compliance.nda_signed_at as signed_at,
            'version_mismatch' as compliance_status,
            'NDA version outdated - new version required' as message;
        RETURN;
    END IF;
    
    -- Check if compliance is still valid
    IF v_user_compliance.compliance_status != 'compliant' THEN
        RETURN QUERY
        SELECT 
            false as is_compliant,
            v_current_version as current_version,
            v_user_compliance.nda_version as user_version,
            v_user_compliance.nda_signed_at as signed_at,
            v_user_compliance.compliance_status as compliance_status,
            'NDA compliance status: ' || v_user_compliance.compliance_status as message;
        RETURN;
    END IF;
    
    -- User is compliant
    RETURN QUERY
    SELECT 
        true as is_compliant,
        v_current_version as current_version,
        v_user_compliance.nda_version as user_version,
        v_user_compliance.nda_signed_at as signed_at,
        'compliant' as compliance_status,
        'NDA compliant - full access granted' as message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sign NDA for a user
CREATE OR REPLACE FUNCTION sign_nda_for_user(
    p_user_id uuid,
    p_nda_version text,
    p_signed_by uuid DEFAULT auth.uid(),
    p_document_hash text DEFAULT NULL,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_current_version text;
    v_result jsonb;
BEGIN
    -- Get current active NDA version
    v_current_version := get_current_nda_version();
    
    -- Validate NDA version
    IF p_nda_version != v_current_version THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid NDA version. Current version is ' || v_current_version
        );
    END IF;
    
    -- Check if user already has a compliant record for this version
    IF EXISTS (
        SELECT 1 FROM user_nda_compliance 
        WHERE user_id = p_user_id 
        AND nda_version = p_nda_version 
        AND compliance_status = 'compliant'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User already has compliant NDA for this version'
        );
    END IF;
    
    -- Insert new NDA compliance record
    INSERT INTO user_nda_compliance (
        user_id,
        nda_version,
        nda_signed_by,
        document_hash,
        ip_address,
        user_agent,
        notes
    ) VALUES (
        p_user_id,
        p_nda_version,
        p_signed_by,
        p_document_hash,
        p_ip_address,
        p_user_agent,
        p_notes
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'NDA signed successfully',
        'nda_version', p_nda_version,
        'signed_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get NDA compliance for all user roles
CREATE OR REPLACE FUNCTION get_user_nda_compliance_for_roles(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
    user_id uuid,
    user_email text,
    user_name text,
    roles jsonb,
    nda_compliance jsonb
) AS $$
DECLARE
    v_user platform_users%ROWTYPE;
    v_roles jsonb;
    v_nda_compliance jsonb;
BEGIN
    -- Get user info
    SELECT * INTO v_user
    FROM platform_users
    WHERE id = p_user_id;
    
    IF v_user IS NULL THEN
        RETURN;
    END IF;
    
    -- Get user roles (this returns a jsonb array)
    SELECT get_user_roles_simple(p_user_id) INTO v_roles;
    
    -- Get NDA compliance
    SELECT jsonb_build_object(
        'is_compliant', unc.is_compliant,
        'current_version', unc.current_version,
        'user_version', unc.user_version,
        'signed_at', unc.signed_at,
        'compliance_status', unc.compliance_status,
        'message', unc.message
    ) INTO v_nda_compliance
    FROM check_user_nda_compliance(p_user_id) unc;
    
    RETURN QUERY
    SELECT 
        v_user.id as user_id,
        v_user.email as user_email,
        v_user.full_name as user_name,
        COALESCE(v_roles, '[]'::jsonb) as roles,
        COALESCE(v_nda_compliance, '{}'::jsonb) as nda_compliance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_nda_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_nda_compliance_updated_at
    BEFORE UPDATE ON user_nda_compliance
    FOR EACH ROW EXECUTE FUNCTION update_nda_compliance_updated_at();

CREATE TRIGGER trigger_update_nda_versions_updated_at
    BEFORE UPDATE ON nda_versions
    FOR EACH ROW EXECUTE FUNCTION update_nda_compliance_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE user_nda_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE nda_versions ENABLE ROW LEVEL SECURITY;

-- Users can view their own NDA compliance
CREATE POLICY "Users can view own NDA compliance" ON user_nda_compliance
    FOR SELECT USING (user_id = auth.uid());

-- Platform admins can manage all NDA compliance
CREATE POLICY "Platform admins can manage all NDA compliance" ON user_nda_compliance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        )
    );

-- Platform admins can manage NDA versions
CREATE POLICY "Platform admins can manage NDA versions" ON nda_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role_type = 'platform_admin'
            AND ur.is_active = true
        )
    );

-- All authenticated users can view active NDA versions
CREATE POLICY "Users can view active NDA versions" ON nda_versions
    FOR SELECT USING (is_active = true);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default NDA version
INSERT INTO nda_versions (
    version,
    title,
    description,
    document_content,
    document_hash,
    is_active,
    effective_date
) VALUES (
    '1.0',
    'Standard NDA Agreement',
    'Default NDA for accessing sales information and buyer features',
    'This Non-Disclosure Agreement (NDA) governs the sharing of confidential information related to debt portfolios and sales data. By signing this agreement, you agree to maintain the confidentiality of all shared information and use it solely for authorized business purposes.',
    encode(sha256('Standard NDA Agreement v1.0'::bytea), 'hex'),
    true,
    now()
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_nda_compliance IS 'Tracks NDA compliance for all users across all roles';
COMMENT ON TABLE nda_versions IS 'Manages different versions of NDA agreements';
COMMENT ON FUNCTION check_user_nda_compliance IS 'Checks if a user is compliant with current NDA version';
COMMENT ON FUNCTION sign_nda_for_user IS 'Records NDA signature for a user';
COMMENT ON FUNCTION get_user_nda_compliance_for_roles IS 'Gets comprehensive NDA compliance info for user and their roles';

-- Log the changes
DO $$
BEGIN
    RAISE NOTICE '✅ Created centralized NDA compliance system:';
    RAISE NOTICE '   - user_nda_compliance table for tracking signatures';
    RAISE NOTICE '   - nda_versions table for version management';
    RAISE NOTICE '   - check_user_nda_compliance function';
    RAISE NOTICE '   - sign_nda_for_user function';
    RAISE NOTICE '   - get_user_nda_compliance_for_roles function';
    RAISE NOTICE '   - Default NDA version 1.0 created';
    RAISE NOTICE '   - RLS policies configured';
END $$; 