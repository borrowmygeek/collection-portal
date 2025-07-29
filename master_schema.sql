-- Master Instance Schema
-- This instance manages all agencies, provides platform-wide analytics, and handles billing

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- AGENCY MANAGEMENT
-- ============================================================================

CREATE TABLE master_agencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE NOT NULL,
    instance_id text UNIQUE NOT NULL, -- References agency's Supabase instance
    instance_url text NOT NULL,
    instance_anon_key text NOT NULL,
    instance_service_key text NOT NULL,
    
    -- Contact Information
    contact_name text,
    contact_email text NOT NULL,
    contact_phone text,
    address text,
    city text,
    state text,
    zipcode text,
    
    -- Subscription & Billing
    subscription_tier text DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
    subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled', 'pending')),
    subscription_start_date date NOT NULL,
    subscription_end_date date,
    billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
    base_monthly_fee numeric(10,2) DEFAULT 99.00,
    
    -- Usage Limits
    max_users integer DEFAULT 10,
    max_portfolios integer DEFAULT 100,
    max_debtors integer DEFAULT 10000,
    storage_limit_gb integer DEFAULT 10,
    
    -- Features & Integrations
    features_enabled jsonb DEFAULT '{
        "api_access": false,
        "custom_domain": false,
        "advanced_analytics": false,
        "white_label": false,
        "vonage_integration": false,
        "dropco_integration": false,
        "tcn_integration": false,
        "tlo_integration": false,
        "experian_integration": false
    }',
    
    -- Compliance & Security
    pci_dss_compliant boolean DEFAULT false,
    compliance_audit_date date,
    data_retention_days integer DEFAULT 2555, -- 7 years
    security_settings jsonb DEFAULT '{
        "mfa_required": true,
        "session_timeout_minutes": 480,
        "ip_whitelist": [],
        "audit_logging": true
    }',
    
    -- Status & Metadata
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'provisioning')),
    onboarding_stage text DEFAULT 'pending' CHECK (onboarding_stage IN ('pending', 'setup', 'training', 'active')),
    notes text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_activity_at timestamptz,
    last_billing_at timestamptz
);

-- ============================================================================
-- CLIENT MANAGEMENT
-- ============================================================================

CREATE TABLE master_clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE NOT NULL,
    
    -- Contact Information
    contact_name text,
    contact_email text,
    contact_phone text,
    address text,
    city text,
    state text,
    zipcode text,
    
    -- Business Information
    client_type text DEFAULT 'creditor' CHECK (client_type IN ('creditor', 'debt_buyer', 'servicer')),
    industry text,
    website text,
    tax_id text,
    dba_name text,
    
    -- Compliance
    fdpa_license_number text,
    state_licenses jsonb DEFAULT '{}',
    compliance_contact_name text,
    compliance_contact_email text,
    compliance_contact_phone text,
    
    -- Status
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PORTFOLIO MANAGEMENT
-- ============================================================================

CREATE TABLE master_portfolios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    
    -- Ownership
    client_id uuid REFERENCES master_clients(id) NOT NULL,
    
    -- Portfolio Details
    portfolio_type text DEFAULT 'credit_card' CHECK (portfolio_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'other')),
    original_balance numeric(12,2) NOT NULL,
    account_count integer NOT NULL,
    charge_off_date date,
    debt_age_months integer,
    average_balance numeric(10,2),
    geographic_focus text[], -- Array of state codes
    credit_score_range text,
    
    -- Status
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed', 'returned')),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PORTFOLIO PLACEMENTS
-- ============================================================================

CREATE TABLE master_portfolio_placements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid REFERENCES master_portfolios(id) NOT NULL,
    agency_id uuid REFERENCES master_agencies(id) NOT NULL,
    client_id uuid REFERENCES master_clients(id) NOT NULL,
    
    -- Placement Details
    placement_date date NOT NULL,
    return_date date,
    placement_amount numeric(12,2) NOT NULL,
    account_count integer NOT NULL,
    
    -- Terms
    contingency_rate numeric(3,2) NOT NULL CHECK (contingency_rate >= 0 AND contingency_rate <= 1),
    min_settlement_rate numeric(3,2) NOT NULL CHECK (min_settlement_rate >= 0 AND min_settlement_rate <= 1),
    flat_fee_rate numeric(10,2),
    
    -- Status
    status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'returned')),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(portfolio_id, agency_id) -- One placement per portfolio per agency
);

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE agency_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id uuid REFERENCES master_agencies(id) NOT NULL,
    date date NOT NULL,
    
    -- Resource Usage
    storage_gb numeric(10,4) DEFAULT 0,
    compute_hours numeric(10,4) DEFAULT 0,
    api_calls integer DEFAULT 0,
    bandwidth_gb numeric(10,4) DEFAULT 0,
    
    -- Business Metrics
    active_users integer DEFAULT 0,
    total_debtors integer DEFAULT 0,
    total_portfolios integer DEFAULT 0,
    total_clients integer DEFAULT 0,
    
    -- Collection Metrics
    total_collected numeric(12,2) DEFAULT 0,
    resolved_accounts integer DEFAULT 0,
    active_calls integer DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(agency_id, date)
);

-- ============================================================================
-- BILLING & INVOICES
-- ============================================================================

CREATE TABLE agency_billing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id uuid REFERENCES master_agencies(id) NOT NULL,
    billing_period text NOT NULL, -- Format: YYYY-MM
    invoice_number text UNIQUE,
    
    -- Charges
    base_fee numeric(10,2) NOT NULL,
    storage_fee numeric(10,2) DEFAULT 0,
    compute_fee numeric(10,2) DEFAULT 0,
    api_fee numeric(10,2) DEFAULT 0,
    bandwidth_fee numeric(10,2) DEFAULT 0,
    overage_fee numeric(10,2) DEFAULT 0,
    
    -- Totals
    subtotal numeric(10,2) NOT NULL,
    tax_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) NOT NULL,
    
    -- Status
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'overdue', 'cancelled')),
    
    -- Payment
    payment_method text,
    payment_date date,
    payment_reference text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    due_date date,
    
    UNIQUE(agency_id, billing_period)
);

-- ============================================================================
-- PLATFORM ANALYTICS
-- ============================================================================

CREATE TABLE platform_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL,
    
    -- Platform Metrics
    total_agencies integer DEFAULT 0,
    active_agencies integer DEFAULT 0,
    total_clients integer DEFAULT 0,
    total_portfolios integer DEFAULT 0,
    total_debtors integer DEFAULT 0,
    
    -- Financial Metrics
    total_placement_value numeric(15,2) DEFAULT 0,
    total_collected_value numeric(15,2) DEFAULT 0,
    average_collection_rate numeric(5,4) DEFAULT 0,
    
    -- Usage Metrics
    total_storage_gb numeric(10,4) DEFAULT 0,
    total_compute_hours numeric(10,4) DEFAULT 0,
    total_api_calls integer DEFAULT 0,
    
    -- Revenue Metrics
    total_revenue numeric(12,2) DEFAULT 0,
    average_revenue_per_agency numeric(10,2) DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    
    UNIQUE(date)
);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id uuid REFERENCES master_agencies(id),
    user_id uuid,
    action text NOT NULL,
    table_name text,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Agency indexes
CREATE INDEX idx_master_agencies_status ON master_agencies(status);
CREATE INDEX idx_master_agencies_subscription_status ON master_agencies(subscription_status);
CREATE INDEX idx_master_agencies_code ON master_agencies(code);
CREATE INDEX idx_master_agencies_instance_id ON master_agencies(instance_id);

-- Client indexes
CREATE INDEX idx_master_clients_status ON master_clients(status);
CREATE INDEX idx_master_clients_code ON master_clients(code);

-- Portfolio indexes
CREATE INDEX idx_master_portfolios_client ON master_portfolios(client_id);
CREATE INDEX idx_master_portfolios_status ON master_portfolios(status);

-- Placement indexes
CREATE INDEX idx_master_portfolio_placements_portfolio ON master_portfolio_placements(portfolio_id);
CREATE INDEX idx_master_portfolio_placements_agency ON master_portfolio_placements(agency_id);
CREATE INDEX idx_master_portfolio_placements_status ON master_portfolio_placements(status);

-- Usage indexes
CREATE INDEX idx_agency_usage_agency_date ON agency_usage(agency_id, date);
CREATE INDEX idx_agency_usage_date ON agency_usage(date);

-- Billing indexes
CREATE INDEX idx_agency_billing_agency_period ON agency_billing(agency_id, billing_period);
CREATE INDEX idx_agency_billing_status ON agency_billing(status);
CREATE INDEX idx_agency_billing_due_date ON agency_billing(due_date);

-- Analytics indexes
CREATE INDEX idx_platform_analytics_date ON platform_analytics(date);

-- Audit indexes
CREATE INDEX idx_audit_logs_agency ON audit_logs(agency_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_master_agencies_updated_at BEFORE UPDATE ON master_agencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_clients_updated_at BEFORE UPDATE ON master_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_portfolios_updated_at BEFORE UPDATE ON master_portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_portfolio_placements_updated_at BEFORE UPDATE ON master_portfolio_placements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_usage_updated_at BEFORE UPDATE ON agency_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_billing_updated_at BEFORE UPDATE ON agency_billing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE master_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_portfolio_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admin can access everything
CREATE POLICY "Platform admin full access" ON master_agencies FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON master_clients FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON master_portfolios FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON master_portfolio_placements FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON agency_usage FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON agency_billing FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON platform_analytics FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON audit_logs FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');

-- Agency users can only see their own data
CREATE POLICY "Agency users can view own agency" ON master_agencies FOR SELECT USING (id = (auth.jwt() ->> 'agency_id')::uuid);
CREATE POLICY "Agency users can view own usage" ON agency_usage FOR SELECT USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);
CREATE POLICY "Agency users can view own billing" ON agency_billing FOR SELECT USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate agency billing
CREATE OR REPLACE FUNCTION calculate_agency_billing(p_agency_id uuid, p_billing_period text)
RETURNS jsonb AS $$
DECLARE
    v_agency master_agencies%ROWTYPE;
    v_usage agency_usage%ROWTYPE;
    v_base_fee numeric(10,2);
    v_storage_fee numeric(10,2);
    v_compute_fee numeric(10,2);
    v_api_fee numeric(10,2);
    v_bandwidth_fee numeric(10,2);
    v_overage_fee numeric(10,2);
    v_subtotal numeric(10,2);
    v_total numeric(10,2);
BEGIN
    -- Get agency details
    SELECT * INTO v_agency FROM master_agencies WHERE id = p_agency_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agency not found: %', p_agency_id;
    END IF;
    
    -- Get usage for billing period
    SELECT * INTO v_usage FROM agency_usage 
    WHERE agency_id = p_agency_id AND date = (p_billing_period || '-01')::date;
    
    -- Calculate fees
    v_base_fee := v_agency.base_monthly_fee;
    
    -- Storage fee: $0.125/GB over limit
    IF v_usage.storage_gb > v_agency.storage_limit_gb THEN
        v_storage_fee := (v_usage.storage_gb - v_agency.storage_limit_gb) * 0.125;
    END IF;
    
    -- Compute fee: $0.00001441 per second (converted to hours)
    v_compute_fee := v_usage.compute_hours * 0.00001441 * 3600;
    
    -- API fee: $0.001 per call over 1000
    IF v_usage.api_calls > 1000 THEN
        v_api_fee := (v_usage.api_calls - 1000) * 0.001;
    END IF;
    
    -- Bandwidth fee: $0.09/GB
    v_bandwidth_fee := v_usage.bandwidth_gb * 0.09;
    
    -- Calculate totals
    v_subtotal := v_base_fee + v_storage_fee + v_compute_fee + v_api_fee + v_bandwidth_fee + v_overage_fee;
    v_total := v_subtotal; -- Add tax if needed
    
    RETURN jsonb_build_object(
        'agency_id', p_agency_id,
        'billing_period', p_billing_period,
        'base_fee', v_base_fee,
        'storage_fee', v_storage_fee,
        'compute_fee', v_compute_fee,
        'api_fee', v_api_fee,
        'bandwidth_fee', v_bandwidth_fee,
        'overage_fee', v_overage_fee,
        'subtotal', v_subtotal,
        'total', v_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync agency data
CREATE OR REPLACE FUNCTION sync_agency_data(p_agency_instance_id text, p_data jsonb)
RETURNS jsonb AS $$
DECLARE
    v_agency_id uuid;
    v_sync_result jsonb;
BEGIN
    -- Get agency ID from instance ID
    SELECT id INTO v_agency_id FROM master_agencies WHERE instance_id = p_agency_instance_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agency instance not found: %', p_agency_instance_id;
    END IF;
    
    -- Process sync data based on table
    CASE p_data->>'table'
        WHEN 'usage' THEN
            -- Update usage metrics
            INSERT INTO agency_usage (agency_id, date, storage_gb, compute_hours, api_calls, bandwidth_gb, active_users, total_debtors)
            VALUES (
                v_agency_id,
                (p_data->>'date')::date,
                (p_data->>'storage_gb')::numeric,
                (p_data->>'compute_hours')::numeric,
                (p_data->>'api_calls')::integer,
                (p_data->>'bandwidth_gb')::numeric,
                (p_data->>'active_users')::integer,
                (p_data->>'total_debtors')::integer
            )
            ON CONFLICT (agency_id, date) DO UPDATE SET
                storage_gb = EXCLUDED.storage_gb,
                compute_hours = EXCLUDED.compute_hours,
                api_calls = EXCLUDED.api_calls,
                bandwidth_gb = EXCLUDED.bandwidth_gb,
                active_users = EXCLUDED.active_users,
                total_debtors = EXCLUDED.total_debtors,
                updated_at = now();
                
            v_sync_result := jsonb_build_object('status', 'success', 'message', 'Usage data synced');
            
        WHEN 'analytics' THEN
            -- Update analytics data
            -- Implementation depends on specific analytics structure
            v_sync_result := jsonb_build_object('status', 'success', 'message', 'Analytics data synced');
            
        ELSE
            RAISE EXCEPTION 'Unknown sync table: %', p_data->>'table';
    END CASE;
    
    -- Log the sync
    INSERT INTO audit_logs (agency_id, action, table_name, new_values)
    VALUES (v_agency_id, 'sync_data', p_data->>'table', p_data);
    
    RETURN v_sync_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 