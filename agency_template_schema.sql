-- Agency Instance Template Schema
-- This is the standardized schema for each agency's Supabase instance
-- No RLS needed since each instance is isolated

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- AGENCY CONFIGURATION
-- ============================================================================

CREATE TABLE agency_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_agency_id uuid NOT NULL, -- Links to master instance
    instance_id text UNIQUE NOT NULL,
    
    -- Agency Information
    name text NOT NULL,
    code text UNIQUE NOT NULL,
    contact_name text,
    contact_email text,
    contact_phone text,
    address text,
    city text,
    state text,
    zipcode text,
    
    -- Subscription Details
    subscription_tier text DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
    subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled')),
    subscription_start_date date,
    subscription_end_date date,
    
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
    
    -- Integration Settings
    vonage_settings jsonb DEFAULT '{}',
    dropco_settings jsonb DEFAULT '{}',
    tcn_settings jsonb DEFAULT '{}',
    tlo_settings jsonb DEFAULT '{}',
    experian_settings jsonb DEFAULT '{}',
    
    -- Compliance Settings
    pci_dss_compliant boolean DEFAULT false,
    compliance_audit_date date,
    data_retention_days integer DEFAULT 2555,
    security_settings jsonb DEFAULT '{
        "mfa_required": true,
        "session_timeout_minutes": 480,
        "ip_whitelist": [],
        "audit_logging": true
    }',
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- USER MANAGEMENT
-- ============================================================================

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'collector' CHECK (role IN ('admin', 'manager', 'collector', 'client')),
    
    -- Contact Information
    phone text,
    extension text,
    
    -- Work Settings
    hourly_rate numeric(10,2) DEFAULT 15.00,
    schedule_start_time time,
    schedule_end_time time,
    timezone text DEFAULT 'America/New_York',
    
    -- Status
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at timestamptz,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- CLIENT MANAGEMENT
-- ============================================================================

CREATE TABLE clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_client_id uuid, -- Links to master instance
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
    
    -- Contract Details
    contract_start_date date,
    contract_end_date date,
    contract_type text DEFAULT 'contingency' CHECK (contract_type IN ('contingency', 'flat_fee', 'hybrid')),
    default_contingency_rate numeric(3,2) DEFAULT 0.30 CHECK (default_contingency_rate >= 0 AND default_contingency_rate <= 1),
    default_min_settlement_rate numeric(3,2) DEFAULT 0.70 CHECK (default_min_settlement_rate >= 0 AND default_min_settlement_rate <= 1),
    payment_terms_days integer DEFAULT 30,
    
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

CREATE TABLE portfolios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_portfolio_id uuid, -- Links to master instance
    name text NOT NULL,
    description text,
    client_id uuid REFERENCES clients(id) NOT NULL,
    
    -- Portfolio Details
    portfolio_type text DEFAULT 'credit_card' CHECK (portfolio_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'other')),
    original_balance numeric(12,2) NOT NULL,
    current_balance numeric(12,2) NOT NULL,
    account_count integer NOT NULL,
    charge_off_date date,
    placement_date date,
    debt_age_months integer,
    average_balance numeric(10,2),
    geographic_focus text[], -- Array of state codes
    credit_score_range text,
    
    -- Collection Terms
    contingency_rate numeric(3,2) NOT NULL CHECK (contingency_rate >= 0 AND contingency_rate <= 1),
    min_settlement_rate numeric(3,2) NOT NULL CHECK (min_settlement_rate >= 0 AND min_settlement_rate <= 1),
    flat_fee_rate numeric(10,2),
    
    -- Collection Strategy
    collection_strategy text DEFAULT 'standard' CHECK (collection_strategy IN ('standard', 'aggressive', 'gentle', 'legal')),
    skip_trace_enabled boolean DEFAULT true,
    auto_dial_enabled boolean DEFAULT false,
    sms_enabled boolean DEFAULT true,
    email_enabled boolean DEFAULT true,
    
    -- Performance Tracking
    status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'returned')),
    completion_rate numeric(3,2) DEFAULT 0,
    total_collected numeric(12,2) DEFAULT 0,
    resolved_accounts integer DEFAULT 0,
    last_activity_date date,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(client_id, name) -- Each client can have only one portfolio with a given name
);

-- ============================================================================
-- PERSON-CENTRIC DATA MODEL
-- ============================================================================

CREATE TABLE persons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ssn text UNIQUE, -- Normalized SSN (digits only)
    full_name text,
    first_name text,
    last_name text,
    dob date,
    is_deceased boolean DEFAULT false,
    deceased_date date,
    homeowner boolean,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- DEBTOR ACCOUNTS
-- ============================================================================

CREATE TABLE debtors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id),
    portfolio_id uuid REFERENCES portfolios(id) NOT NULL,
    client_id uuid REFERENCES clients(id) NOT NULL,
    
    -- Account Information
    account_number text,
    original_creditor text,
    original_balance numeric(12,2) NOT NULL,
    current_balance numeric(12,2) NOT NULL,
    charge_off_date date,
    date_opened date,
    
    -- Contact Information
    address text,
    city text,
    state text,
    zipcode text,
    email text,
    
    -- Status & Tracking
    status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'promise_to_pay', 'payment_received', 'resolved', 'do_not_call', 'bankruptcy', 'deceased')),
    assigned_collector uuid REFERENCES users(id),
    last_call_date timestamptz,
    next_call_date timestamptz,
    last_payment_date date,
    
    -- Collection Data
    total_payments numeric(12,2) DEFAULT 0,
    payment_count integer DEFAULT 0,
    last_promise_amount numeric(10,2),
    last_promise_date date,
    
    -- Metadata
    timezone text,
    homeowner boolean,
    address_confirmed boolean DEFAULT false,
    sms_consent boolean DEFAULT false,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SKIP-TRACE DATA
-- ============================================================================

CREATE TABLE person_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    full_address text NOT NULL,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zipcode text,
    county text,
    address_type text DEFAULT 'residential' CHECK (address_type IN ('residential', 'mailing', 'business')),
    is_current boolean DEFAULT false,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE phone_numbers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    number text NOT NULL,
    phone_type text DEFAULT 'mobile' CHECK (phone_type IN ('mobile', 'home', 'work', 'fax')),
    status text DEFAULT 'unknown' CHECK (status IN ('unknown', 'good', 'bad', 'disconnected', 'wrong_number')),
    carrier text,
    timezone text,
    is_current boolean DEFAULT false,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    email_address text NOT NULL,
    email_type text DEFAULT 'personal' CHECK (email_type IN ('personal', 'work', 'other')),
    is_current boolean DEFAULT false,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE relatives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    name text NOT NULL,
    relationship text,
    phone text,
    address text,
    email text,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    address text NOT NULL,
    city text,
    state text,
    zip text,
    county text,
    market_value numeric(12,2),
    purchase_date date,
    property_type text DEFAULT 'residential' CHECK (property_type IN ('residential', 'commercial', 'land')),
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    vin text,
    make text,
    model text,
    year integer,
    license_plate text,
    state text,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE places_of_employment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    employer_name text NOT NULL,
    address text,
    city text,
    state text,
    zipcode text,
    phone text,
    position text,
    start_date date,
    end_date date,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE bankruptcies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    case_number text,
    filing_date date,
    discharge_date date,
    chapter text,
    court_district text,
    attorney_name text,
    amount numeric(12,2),
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- COLLECTION ACTIVITIES
-- ============================================================================

CREATE TABLE calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id) NOT NULL,
    collector_id uuid REFERENCES users(id),
    phone_number text NOT NULL,
    call_type text DEFAULT 'outbound' CHECK (call_type IN ('inbound', 'outbound')),
    status text DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'voicemail', 'busy', 'no_answer', 'failed')),
    duration_seconds integer,
    recording_url text,
    transcription text,
    notes text,
    call_sid text, -- For Twilio integration
    created_at timestamptz DEFAULT now()
);

CREATE TABLE notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id) NOT NULL,
    user_id uuid REFERENCES users(id) NOT NULL,
    content text NOT NULL,
    note_type text DEFAULT 'general' CHECK (note_type IN ('general', 'promise', 'payment', 'skip_trace', 'legal', 'system')),
    pinned boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id) NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method text NOT NULL CHECK (payment_method IN ('credit_card', 'bank_account', 'check', 'money_order', 'cash')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    transaction_id text,
    payment_date date NOT NULL,
    processed_at timestamptz,
    
    -- Payment method details
    card_last4 text,
    card_brand text,
    routing_number text,
    account_last4 text,
    account_type text,
    
    -- Metadata
    failure_reason text,
    created_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INTEGRATION DATA
-- ============================================================================

CREATE TABLE vonage_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_uuid text UNIQUE,
    debtor_id uuid REFERENCES debtors(id),
    from_number text,
    to_number text,
    status text,
    duration integer,
    recording_url text,
    transcription text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE dropco_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id),
    document_type text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'failed')),
    tracking_id text,
    delivery_date timestamptz,
    opened_date timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE tcn_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id text UNIQUE,
    debtor_id uuid REFERENCES debtors(id),
    phone_number text,
    status text,
    duration integer,
    recording_url text,
    compliance_data jsonb,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE usage_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
    
    UNIQUE(date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Agency config indexes
CREATE INDEX idx_agency_config_instance_id ON agency_config(instance_id);
CREATE INDEX idx_agency_config_master_agency_id ON agency_config(master_agency_id);

-- User indexes
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Client indexes
CREATE INDEX idx_clients_master_client_id ON clients(master_client_id);
CREATE INDEX idx_clients_code ON clients(code);
CREATE INDEX idx_clients_status ON clients(status);

-- Portfolio indexes
CREATE INDEX idx_portfolios_master_portfolio_id ON portfolios(master_portfolio_id);
CREATE INDEX idx_portfolios_client_id ON portfolios(client_id);
CREATE INDEX idx_portfolios_status ON portfolios(status);

-- Person indexes
CREATE INDEX idx_persons_ssn ON persons(ssn);
CREATE INDEX idx_persons_full_name ON persons USING gin(full_name gin_trgm_ops);

-- Debtor indexes
CREATE INDEX idx_debtors_person_id ON debtors(person_id);
CREATE INDEX idx_debtors_portfolio_id ON debtors(portfolio_id);
CREATE INDEX idx_debtors_client_id ON debtors(client_id);
CREATE INDEX idx_debtors_status ON debtors(status);
CREATE INDEX idx_debtors_assigned_collector ON debtors(assigned_collector);
CREATE INDEX idx_debtors_last_call_date ON debtors(last_call_date);
CREATE INDEX idx_debtors_next_call_date ON debtors(next_call_date);

-- Skip-trace indexes
CREATE INDEX idx_person_addresses_person_id ON person_addresses(person_id);
CREATE INDEX idx_phone_numbers_person_id ON phone_numbers(person_id);
CREATE INDEX idx_phone_numbers_number ON phone_numbers(number);
CREATE INDEX idx_emails_person_id ON emails(person_id);
CREATE INDEX idx_relatives_person_id ON relatives(person_id);
CREATE INDEX idx_properties_person_id ON properties(person_id);
CREATE INDEX idx_vehicles_person_id ON vehicles(person_id);
CREATE INDEX idx_places_of_employment_person_id ON places_of_employment(person_id);
CREATE INDEX idx_bankruptcies_person_id ON bankruptcies(person_id);

-- Activity indexes
CREATE INDEX idx_calls_debtor_id ON calls(debtor_id);
CREATE INDEX idx_calls_collector_id ON calls(collector_id);
CREATE INDEX idx_calls_created_at ON calls(created_at);
CREATE INDEX idx_notes_debtor_id ON notes(debtor_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_payments_debtor_id ON payments(debtor_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Integration indexes
CREATE INDEX idx_vonage_calls_debtor_id ON vonage_calls(debtor_id);
CREATE INDEX idx_dropco_documents_debtor_id ON dropco_documents(debtor_id);
CREATE INDEX idx_tcn_calls_debtor_id ON tcn_calls(debtor_id);

-- Usage indexes
CREATE INDEX idx_usage_metrics_date ON usage_metrics(date);

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

CREATE TRIGGER update_agency_config_updated_at BEFORE UPDATE ON agency_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debtors_updated_at BEFORE UPDATE ON debtors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_metrics_updated_at BEFORE UPDATE ON usage_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to sync usage data to master instance
CREATE OR REPLACE FUNCTION sync_usage_to_master()
RETURNS void AS $$
DECLARE
    v_agency_config agency_config%ROWTYPE;
    v_usage_data jsonb;
    v_master_url text;
    v_master_key text;
BEGIN
    -- Get agency configuration
    SELECT * INTO v_agency_config FROM agency_config LIMIT 1;
    IF NOT FOUND THEN
        RAISE NOTICE 'No agency configuration found';
        RETURN;
    END IF;
    
    -- Get today's usage data
    SELECT jsonb_build_object(
        'table', 'usage',
        'date', CURRENT_DATE::text,
        'storage_gb', COALESCE(storage_gb, 0),
        'compute_hours', COALESCE(compute_hours, 0),
        'api_calls', COALESCE(api_calls, 0),
        'bandwidth_gb', COALESCE(bandwidth_gb, 0),
        'active_users', COALESCE(active_users, 0),
        'total_debtors', COALESCE(total_debtors, 0)
    ) INTO v_usage_data
    FROM usage_metrics 
    WHERE date = CURRENT_DATE;
    
    -- If no usage data for today, create default
    IF v_usage_data IS NULL THEN
        v_usage_data := jsonb_build_object(
            'table', 'usage',
            'date', CURRENT_DATE::text,
            'storage_gb', 0,
            'compute_hours', 0,
            'api_calls', 0,
            'bandwidth_gb', 0,
            'active_users', (SELECT COUNT(*) FROM users WHERE status = 'active'),
            'total_debtors', (SELECT COUNT(*) FROM debtors)
        );
    END IF;
    
    -- TODO: Implement HTTP call to master instance
    -- This would use pg_net extension to make HTTP requests
    -- For now, just log the data
    RAISE NOTICE 'Syncing usage data: %', v_usage_data;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate portfolio performance
CREATE OR REPLACE FUNCTION calculate_portfolio_performance(p_portfolio_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_portfolio portfolios%ROWTYPE;
    v_total_collected numeric(12,2);
    v_resolved_accounts integer;
    v_completion_rate numeric(3,2);
BEGIN
    -- Get portfolio details
    SELECT * INTO v_portfolio FROM portfolios WHERE id = p_portfolio_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Portfolio not found: %', p_portfolio_id;
    END IF;
    
    -- Calculate performance metrics
    SELECT 
        COALESCE(SUM(amount), 0),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total_collected, v_resolved_accounts
    FROM payments p
    JOIN debtors d ON p.debtor_id = d.id
    WHERE d.portfolio_id = p_portfolio_id;
    
    -- Calculate completion rate
    v_completion_rate := CASE 
        WHEN v_portfolio.account_count > 0 THEN 
            (v_resolved_accounts::numeric / v_portfolio.account_count)::numeric(3,2)
        ELSE 0 
    END;
    
    -- Update portfolio with new metrics
    UPDATE portfolios 
    SET 
        total_collected = v_total_collected,
        resolved_accounts = v_resolved_accounts,
        completion_rate = v_completion_rate,
        updated_at = now()
    WHERE id = p_portfolio_id;
    
    RETURN jsonb_build_object(
        'portfolio_id', p_portfolio_id,
        'total_collected', v_total_collected,
        'resolved_accounts', v_resolved_accounts,
        'completion_rate', v_completion_rate,
        'account_count', v_portfolio.account_count
    );
END;
$$ LANGUAGE plpgsql;

-- Function to normalize SSN
CREATE OR REPLACE FUNCTION normalize_ssn(p_ssn text)
RETURNS text AS $$
BEGIN
    -- Remove all non-digits and convert z/Z to 0
    RETURN regexp_replace(regexp_replace(p_ssn, '[zZ]', '0', 'g'), '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to link person to debtor
CREATE OR REPLACE FUNCTION link_person_to_debtor(p_debtor_id uuid, p_ssn text)
RETURNS uuid AS $$
DECLARE
    v_normalized_ssn text;
    v_person_id uuid;
BEGIN
    -- Normalize SSN
    v_normalized_ssn := normalize_ssn(p_ssn);
    
    -- Check if SSN is valid (9 digits)
    IF length(v_normalized_ssn) != 9 THEN
        RAISE EXCEPTION 'Invalid SSN: %', p_ssn;
    END IF;
    
    -- Find or create person
    SELECT id INTO v_person_id FROM persons WHERE ssn = v_normalized_ssn;
    
    IF v_person_id IS NULL THEN
        -- Create new person
        INSERT INTO persons (ssn) VALUES (v_normalized_ssn)
        RETURNING id INTO v_person_id;
    END IF;
    
    -- Update debtor with person_id
    UPDATE debtors SET person_id = v_person_id WHERE id = p_debtor_id;
    
    RETURN v_person_id;
END;
$$ LANGUAGE plpgsql; 