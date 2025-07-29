-- Person-Centric Data Model Migration
-- This migration replaces the account-centric model with a person-centric model
-- where persons are the central entity and debtors represent individual accounts

-- ============================================================================
-- STEP 1: ENABLE EXTENSIONS
-- ============================================================================

-- Enable pg_trgm for text search capabilities
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STEP 2: CREATE PERSON-CENTRIC TABLES
-- ============================================================================

-- Central persons table
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

-- Debtor accounts (individual accounts linking to persons)
CREATE TABLE debtors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id),
    portfolio_id uuid REFERENCES master_portfolios(id) NOT NULL,
    client_id uuid REFERENCES master_clients(id) NOT NULL,
    
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
    assigned_collector uuid REFERENCES platform_users(id),
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
-- STEP 3: CREATE SATELLITE TABLES
-- ============================================================================

-- Person addresses
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

-- Phone numbers
CREATE TABLE phone_numbers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    number text NOT NULL,
    phone_type text DEFAULT 'mobile' CHECK (phone_type IN ('mobile', 'home', 'work', 'other')),
    is_current boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- Email addresses
CREATE TABLE emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    email text NOT NULL,
    is_current boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- Relatives
CREATE TABLE relatives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    relative_name text NOT NULL,
    relationship text,
    phone_number text,
    address text,
    city text,
    state text,
    zipcode text,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- Properties
CREATE TABLE properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    parcel_id text,
    address text NOT NULL,
    city text,
    state text,
    zipcode text,
    property_type text DEFAULT 'residential' CHECK (property_type IN ('residential', 'commercial', 'land')),
    estimated_value numeric(12,2),
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- Vehicles
CREATE TABLE vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    vin text,
    make text,
    model text,
    year integer,
    color text,
    license_plate text,
    state text,
    estimated_value numeric(10,2),
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- Places of employment
CREATE TABLE places_of_employment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    employer_name text NOT NULL,
    job_title text,
    address text,
    city text,
    state text,
    zipcode text,
    phone_number text,
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- Bankruptcies
CREATE TABLE bankruptcies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) NOT NULL,
    case_number text,
    filing_date date,
    discharge_date date,
    bankruptcy_type text CHECK (bankruptcy_type IN ('chapter_7', 'chapter_11', 'chapter_13')),
    court text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'discharged', 'dismissed')),
    first_seen date,
    last_seen date,
    source text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 4: CREATE INDEXES
-- ============================================================================

-- Persons indexes
CREATE INDEX idx_persons_ssn ON persons(ssn);
CREATE INDEX idx_persons_full_name ON persons USING gin(full_name gin_trgm_ops);

-- Debtors indexes
CREATE INDEX idx_debtors_person_id ON debtors(person_id);
CREATE INDEX idx_debtors_portfolio_id ON debtors(portfolio_id);
CREATE INDEX idx_debtors_client_id ON debtors(client_id);
CREATE INDEX idx_debtors_status ON debtors(status);
CREATE INDEX idx_debtors_assigned_collector ON debtors(assigned_collector);
CREATE INDEX idx_debtors_last_call_date ON debtors(last_call_date);
CREATE INDEX idx_debtors_next_call_date ON debtors(next_call_date);

-- Satellite table indexes
CREATE INDEX idx_person_addresses_person_id ON person_addresses(person_id);
CREATE INDEX idx_phone_numbers_person_id ON phone_numbers(person_id);
CREATE INDEX idx_phone_numbers_number ON phone_numbers(number);
CREATE INDEX idx_emails_person_id ON emails(person_id);
CREATE INDEX idx_relatives_person_id ON relatives(person_id);
CREATE INDEX idx_properties_person_id ON properties(person_id);
CREATE INDEX idx_vehicles_person_id ON vehicles(person_id);
CREATE INDEX idx_places_of_employment_person_id ON places_of_employment(person_id);
CREATE INDEX idx_bankruptcies_person_id ON bankruptcies(person_id);

-- ============================================================================
-- STEP 5: CREATE TRIGGERS
-- ============================================================================

-- Update timestamps for all new tables
CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debtors_updated_at BEFORE UPDATE ON debtors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to normalize SSN (remove non-digits)
CREATE OR REPLACE FUNCTION normalize_ssn(p_ssn text)
RETURNS text AS $$
BEGIN
    RETURN regexp_replace(p_ssn, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to link a person to a debtor by SSN
CREATE OR REPLACE FUNCTION link_person_to_debtor(p_debtor_id uuid, p_ssn text)
RETURNS uuid AS $$
DECLARE
    v_person_id uuid;
    v_normalized_ssn text;
BEGIN
    v_normalized_ssn := normalize_ssn(p_ssn);
    
    -- Find existing person by SSN
    SELECT id INTO v_person_id 
    FROM persons 
    WHERE ssn = v_normalized_ssn;
    
    -- If person doesn't exist, create them
    IF v_person_id IS NULL THEN
        INSERT INTO persons (ssn) 
        VALUES (v_normalized_ssn)
        RETURNING id INTO v_person_id;
    END IF;
    
    -- Update debtor with person_id
    UPDATE debtors 
    SET person_id = v_person_id 
    WHERE id = p_debtor_id;
    
    RETURN v_person_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get person summary with all related data
CREATE OR REPLACE FUNCTION get_person_summary(p_person_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'person', row_to_json(p.*),
        'debtors', COALESCE(
            (SELECT jsonb_agg(row_to_json(d.*))
             FROM debtors d
             WHERE d.person_id = p_person_id), 
            '[]'::jsonb
        ),
        'addresses', COALESCE(
            (SELECT jsonb_agg(row_to_json(pa.*))
             FROM person_addresses pa
             WHERE pa.person_id = p_person_id),
            '[]'::jsonb
        ),
        'phones', COALESCE(
            (SELECT jsonb_agg(row_to_json(pn.*))
             FROM phone_numbers pn
             WHERE pn.person_id = p_person_id),
            '[]'::jsonb
        ),
        'emails', COALESCE(
            (SELECT jsonb_agg(row_to_json(e.*))
             FROM emails e
             WHERE e.person_id = p_person_id),
            '[]'::jsonb
        ),
        'relatives', COALESCE(
            (SELECT jsonb_agg(row_to_json(r.*))
             FROM relatives r
             WHERE r.person_id = p_person_id),
            '[]'::jsonb
        ),
        'properties', COALESCE(
            (SELECT jsonb_agg(row_to_json(prop.*))
             FROM properties prop
             WHERE prop.person_id = p_person_id),
            '[]'::jsonb
        ),
        'vehicles', COALESCE(
            (SELECT jsonb_agg(row_to_json(v.*))
             FROM vehicles v
             WHERE v.person_id = p_person_id),
            '[]'::jsonb
        ),
        'employment', COALESCE(
            (SELECT jsonb_agg(row_to_json(emp.*))
             FROM places_of_employment emp
             WHERE emp.person_id = p_person_id),
            '[]'::jsonb
        ),
        'bankruptcies', COALESCE(
            (SELECT jsonb_agg(row_to_json(b.*))
             FROM bankruptcies b
             WHERE b.person_id = p_person_id),
            '[]'::jsonb
        )
    ) INTO v_result
    FROM persons p
    WHERE p.id = p_person_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE places_of_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankruptcies ENABLE ROW LEVEL SECURITY;

-- Platform admin can access everything
CREATE POLICY "Platform admin full access" ON persons FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON debtors FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON person_addresses FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON phone_numbers FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON emails FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON relatives FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON properties FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON vehicles FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON places_of_employment FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON bankruptcies FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Agency users can view assigned debtors and related data
CREATE POLICY "Agency users can view assigned debtors" ON debtors FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND portfolio_id IN (
        SELECT portfolio_id FROM master_portfolio_placements 
        WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    )
);

CREATE POLICY "Agency users can view debtor persons" ON persons FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

-- Similar policies for satellite tables
CREATE POLICY "Agency users can view debtor addresses" ON person_addresses FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor phones" ON phone_numbers FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor emails" ON emails FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor relatives" ON relatives FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor properties" ON properties FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor vehicles" ON vehicles FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor employment" ON places_of_employment FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor bankruptcies" ON bankruptcies FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND person_id IN (
        SELECT person_id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

-- ============================================================================
-- STEP 8: MIGRATION NOTES
-- ============================================================================

-- Note: This migration creates the person-centric model but doesn't migrate existing data
-- from master_accounts. A separate data migration script will be needed to:
-- 1. Extract person data from master_accounts
-- 2. Create persons records
-- 3. Create debtors records linking to persons
-- 4. Migrate any existing skip-trace data 