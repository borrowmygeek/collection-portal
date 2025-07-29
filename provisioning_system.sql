-- Agency Provisioning System
-- This system manages the creation and configuration of agency instances

-- ============================================================================
-- PROVISIONING MANAGEMENT
-- ============================================================================

CREATE TABLE provisioning_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    contact_name text,
    
    -- Request Details
    subscription_tier text DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
    estimated_debtors integer DEFAULT 1000,
    estimated_users integer DEFAULT 5,
    
    -- Status
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'provisioning', 'active', 'rejected')),
    approved_by uuid,
    approved_at timestamptz,
    
    -- Provisioning Details
    instance_id text,
    instance_url text,
    admin_credentials jsonb,
    
    -- Notes
    notes text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE provisioning_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES provisioning_requests(id),
    step text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    details jsonb,
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PROVISIONING FUNCTIONS
-- ============================================================================

-- Function to create a new agency instance
CREATE OR REPLACE FUNCTION provision_agency_instance(p_request_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_request provisioning_requests%ROWTYPE;
    v_instance_id text;
    v_instance_url text;
    v_admin_email text;
    v_admin_password text;
    v_result jsonb;
BEGIN
    -- Get request details
    SELECT * INTO v_request FROM provisioning_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provisioning request not found: %', p_request_id;
    END IF;
    
    -- Generate unique instance ID
    v_instance_id := 'agency-' || lower(regexp_replace(v_request.agency_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || extract(epoch from now())::text;
    
    -- Generate admin credentials
    v_admin_email := 'admin@' || v_instance_id || '.collectionplatform.com';
    v_admin_password := encode(gen_random_bytes(16), 'base64');
    
    -- Log provisioning start
    INSERT INTO provisioning_logs (request_id, step, status, details)
    VALUES (p_request_id, 'create_instance', 'in_progress', jsonb_build_object('instance_id', v_instance_id));
    
    -- TODO: Implement actual Supabase instance creation
    -- This would use Supabase Management API or Terraform
    -- For now, simulate the process
    
    -- Update request with instance details
    UPDATE provisioning_requests 
    SET 
        status = 'provisioning',
        instance_id = v_instance_id,
        instance_url = 'https://' || v_instance_id || '.supabase.co',
        admin_credentials = jsonb_build_object(
            'email', v_admin_email,
            'password', v_admin_password
        ),
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Log completion
    INSERT INTO provisioning_logs (request_id, step, status, details)
    VALUES (p_request_id, 'create_instance', 'completed', jsonb_build_object('instance_id', v_instance_id));
    
    -- Initialize agency configuration
    PERFORM initialize_agency_config(p_request_id);
    
    -- Set up integrations
    PERFORM setup_agency_integrations(p_request_id);
    
    -- Mark as active
    UPDATE provisioning_requests 
    SET status = 'active', updated_at = now()
    WHERE id = p_request_id;
    
    -- Create agency record in master_agencies
    INSERT INTO master_agencies (
        name, code, instance_id, instance_url, contact_email, contact_name, contact_phone,
        subscription_tier, subscription_start_date, base_monthly_fee
    ) VALUES (
        v_request.agency_name,
        lower(regexp_replace(v_request.agency_name, '[^a-zA-Z0-9]', '', 'g')),
        v_instance_id,
        'https://' || v_instance_id || '.supabase.co',
        v_request.contact_email,
        v_request.contact_name,
        v_request.contact_phone,
        v_request.subscription_tier,
        CURRENT_DATE,
        CASE v_request.subscription_tier
            WHEN 'basic' THEN 99.00
            WHEN 'professional' THEN 199.00
            WHEN 'enterprise' THEN 399.00
        END
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'instance_id', v_instance_id,
        'instance_url', 'https://' || v_instance_id || '.supabase.co',
        'admin_email', v_admin_email,
        'admin_password', v_admin_password
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO provisioning_logs (request_id, step, status, error_message)
    VALUES (p_request_id, 'create_instance', 'failed', SQLERRM);
    
    -- Update request status
    UPDATE provisioning_requests 
    SET status = 'failed', updated_at = now()
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize agency configuration
CREATE OR REPLACE FUNCTION initialize_agency_config(p_request_id uuid)
RETURNS void AS $$
DECLARE
    v_request provisioning_requests%ROWTYPE;
    v_instance_id text;
BEGIN
    -- Get request details
    SELECT * INTO v_request FROM provisioning_requests WHERE id = p_request_id;
    v_instance_id := v_request.instance_id;
    
    -- Log initialization start
    INSERT INTO provisioning_logs (request_id, step, status, details)
    VALUES (p_request_id, 'initialize_config', 'in_progress', jsonb_build_object('instance_id', v_instance_id));
    
    -- TODO: Execute agency template schema on the new instance
    -- This would use the agency_template_schema.sql file
    -- For now, simulate the process
    
    -- Log completion
    INSERT INTO provisioning_logs (request_id, step, status, details)
    VALUES (p_request_id, 'initialize_config', 'completed', jsonb_build_object('instance_id', v_instance_id));
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO provisioning_logs (request_id, step, status, error_message)
    VALUES (p_request_id, 'initialize_config', 'failed', SQLERRM);
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set up agency integrations
CREATE OR REPLACE FUNCTION setup_agency_integrations(p_request_id uuid)
RETURNS void AS $$
DECLARE
    v_request provisioning_requests%ROWTYPE;
BEGIN
    -- Get request details
    SELECT * INTO v_request FROM provisioning_requests WHERE id = p_request_id;
    
    -- Log integration setup start
    INSERT INTO provisioning_logs (request_id, step, status, details)
    VALUES (p_request_id, 'setup_integrations', 'in_progress', '{}');
    
    -- TODO: Set up default integrations based on subscription tier
    -- Vonage, Drop.co, TCN, TLO, Experian
    
    -- Log completion
    INSERT INTO provisioning_logs (request_id, step, status, details)
    VALUES (p_request_id, 'setup_integrations', 'completed', '{}');
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO provisioning_logs (request_id, step, status, error_message)
    VALUES (p_request_id, 'setup_integrations', 'failed', SQLERRM);
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve provisioning request
CREATE OR REPLACE FUNCTION approve_provisioning_request(p_request_id uuid, p_approved_by uuid)
RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- Update request status
    UPDATE provisioning_requests 
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Start provisioning process
    SELECT provision_agency_instance(p_request_id) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get provisioning status
CREATE OR REPLACE FUNCTION get_provisioning_status(p_request_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_request provisioning_requests%ROWTYPE;
    v_logs jsonb;
BEGIN
    -- Get request details
    SELECT * INTO v_request FROM provisioning_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provisioning request not found: %', p_request_id;
    END IF;
    
    -- Get logs
    SELECT jsonb_agg(jsonb_build_object(
        'step', step,
        'status', status,
        'details', details,
        'error_message', error_message,
        'created_at', created_at
    ) ORDER BY created_at) INTO v_logs
    FROM provisioning_logs 
    WHERE request_id = p_request_id;
    
    RETURN jsonb_build_object(
        'request_id', p_request_id,
        'agency_name', v_request.agency_name,
        'status', v_request.status,
        'instance_id', v_request.instance_id,
        'instance_url', v_request.instance_url,
        'admin_credentials', v_request.admin_credentials,
        'logs', v_logs,
        'created_at', v_request.created_at,
        'updated_at', v_request.updated_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MONITORING FUNCTIONS
-- ============================================================================

-- Function to monitor all agency instances
CREATE OR REPLACE FUNCTION monitor_agency_instances()
RETURNS TABLE(
    agency_id uuid,
    agency_name text,
    instance_id text,
    status text,
    last_sync_at timestamptz,
    storage_gb numeric,
    active_users integer,
    total_debtors integer,
    subscription_tier text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ma.id,
        ma.name,
        ma.instance_id,
        ma.status,
        ma.last_activity_at,
        COALESCE(au.storage_gb, 0),
        COALESCE(au.active_users, 0),
        COALESCE(au.total_debtors, 0),
        ma.subscription_tier
    FROM master_agencies ma
    LEFT JOIN agency_usage au ON ma.id = au.agency_id AND au.date = CURRENT_DATE
    WHERE ma.status IN ('active', 'suspended')
    ORDER BY ma.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate billing report
CREATE OR REPLACE FUNCTION generate_billing_report(p_billing_period text)
RETURNS TABLE(
    agency_id uuid,
    agency_name text,
    subscription_tier text,
    base_fee numeric,
    storage_fee numeric,
    compute_fee numeric,
    api_fee numeric,
    bandwidth_fee numeric,
    total_amount numeric,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ma.id,
        ma.name,
        ma.subscription_tier,
        ma.base_monthly_fee,
        COALESCE(ab.storage_fee, 0),
        COALESCE(ab.compute_fee, 0),
        COALESCE(ab.api_fee, 0),
        COALESCE(ab.bandwidth_fee, 0),
        COALESCE(ab.total_amount, ma.base_monthly_fee),
        COALESCE(ab.status, 'pending')
    FROM master_agencies ma
    LEFT JOIN agency_billing ab ON ma.id = ab.agency_id AND ab.billing_period = p_billing_period
    WHERE ma.status = 'active'
    ORDER BY ma.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync usage data from all agencies
CREATE OR REPLACE FUNCTION sync_all_agency_usage()
RETURNS jsonb AS $$
DECLARE
    v_agency record;
    v_sync_count integer := 0;
    v_error_count integer := 0;
    v_errors jsonb := '[]'::jsonb;
BEGIN
    -- Loop through all active agencies
    FOR v_agency IN 
        SELECT id, name, instance_id, instance_url 
        FROM master_agencies 
        WHERE status = 'active'
    LOOP
        BEGIN
            -- TODO: Make HTTP call to agency instance to get usage data
            -- This would use pg_net extension
            -- For now, simulate the sync
            
            -- Update last activity
            UPDATE master_agencies 
            SET last_activity_at = now()
            WHERE id = v_agency.id;
            
            v_sync_count := v_sync_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := v_errors || jsonb_build_object(
                'agency_id', v_agency.id,
                'agency_name', v_agency.name,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'sync_count', v_sync_count,
        'error_count', v_error_count,
        'errors', v_errors
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_provisioning_requests_status ON provisioning_requests(status);
CREATE INDEX idx_provisioning_requests_created_at ON provisioning_requests(created_at);
CREATE INDEX idx_provisioning_logs_request_id ON provisioning_logs(request_id);
CREATE INDEX idx_provisioning_logs_step ON provisioning_logs(step);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_provisioning_requests_updated_at BEFORE UPDATE ON provisioning_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE provisioning_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioning_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all provisioning
CREATE POLICY "Platform admin full access" ON provisioning_requests FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON provisioning_logs FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');

-- Agency users can view their own provisioning requests
CREATE POLICY "Agency users can view own requests" ON provisioning_requests FOR SELECT USING (contact_email = auth.jwt() ->> 'email');
CREATE POLICY "Agency users can view own logs" ON provisioning_logs FOR SELECT USING (
    request_id IN (
        SELECT id FROM provisioning_requests WHERE contact_email = auth.jwt() ->> 'email'
    )
); 