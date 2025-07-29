-- Enhance Person-Centric Tables Migration
-- This migration adds comprehensive fields to the person-centric model

-- ============================================================================
-- STEP 1: ENHANCE PERSONS TABLE
-- ============================================================================

-- Add comprehensive name fields to persons table
ALTER TABLE persons ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS name_prefix text CHECK (name_prefix IN ('Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Rev.', 'Sr.', 'Jr.', 'III', 'IV'));
ALTER TABLE persons ADD COLUMN IF NOT EXISTS name_suffix text CHECK (name_suffix IN ('Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'Ph.D.', 'M.D.', 'Esq.', 'CPA', 'MBA'));
ALTER TABLE persons ADD COLUMN IF NOT EXISTS maiden_name text;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS preferred_name text;

-- Add comprehensive contact and demographic fields
ALTER TABLE persons ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
ALTER TABLE persons ADD COLUMN IF NOT EXISTS marital_status text CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'separated', 'domestic_partnership'));
ALTER TABLE persons ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS employer text;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS annual_income numeric(12,2);
ALTER TABLE persons ADD COLUMN IF NOT EXISTS credit_score integer CHECK (credit_score >= 300 AND credit_score <= 850);

-- Add comprehensive address fields
ALTER TABLE persons ADD COLUMN IF NOT EXISTS primary_address_id uuid REFERENCES person_addresses(id);
ALTER TABLE persons ADD COLUMN IF NOT EXISTS primary_phone_id uuid REFERENCES phone_numbers(id);
ALTER TABLE persons ADD COLUMN IF NOT EXISTS primary_email_id uuid REFERENCES emails(id);

-- Add compliance and preference fields
ALTER TABLE persons ADD COLUMN IF NOT EXISTS do_not_call boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS do_not_mail boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS do_not_email boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS do_not_text boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS bankruptcy_filed boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS active_military boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS deceased_verified boolean DEFAULT false;

-- Add verification and source fields
ALTER TABLE persons ADD COLUMN IF NOT EXISTS ssn_verified boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS data_source text;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS last_skip_trace_date date;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS skip_trace_quality_score integer CHECK (skip_trace_quality_score >= 1 AND skip_trace_quality_score <= 10);

-- ============================================================================
-- STEP 2: ENHANCE DEBTORS TABLE
-- ============================================================================

-- Add comprehensive account fields
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'credit_card' CHECK (account_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'student_loan', 'business_loan', 'other'));
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS account_subtype text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'resolved', 'returned', 'bankruptcy', 'deceased', 'settled', 'paid_in_full'));
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS last_payment_amount numeric(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS last_payment_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS promise_to_pay_amount numeric(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS promise_to_pay_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS settlement_offered numeric(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS settlement_accepted boolean DEFAULT false;

-- Add comprehensive contact fields
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS phone_primary text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS phone_secondary text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS phone_work text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS email_primary text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS email_secondary text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS zipcode text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA';

-- Add comprehensive collection fields
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS collection_status text DEFAULT 'new' CHECK (collection_status IN ('new', 'contacted', 'promise_to_pay', 'payment_received', 'resolved', 'do_not_call', 'bankruptcy', 'deceased', 'settled', 'paid_in_full', 'returned'));
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS collection_priority text DEFAULT 'normal' CHECK (collection_priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS assigned_collector_id uuid REFERENCES platform_users(id);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS assigned_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS last_contact_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS next_contact_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS contact_method text CHECK (contact_method IN ('phone', 'email', 'mail', 'text', 'in_person'));
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS contact_result text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS contact_notes text;

-- Add comprehensive payment fields
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS total_payments numeric(12,2) DEFAULT 0;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS payment_count integer DEFAULT 0;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS average_payment numeric(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS largest_payment numeric(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS payment_frequency text CHECK (payment_frequency IN ('one_time', 'monthly', 'bi_weekly', 'weekly', 'irregular'));

-- Add comprehensive compliance fields
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS do_not_call boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS do_not_mail boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS do_not_email boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS do_not_text boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS bankruptcy_filed boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS active_military boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS hardship_declared boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS hardship_type text CHECK (hardship_type IN ('medical', 'unemployment', 'disability', 'natural_disaster', 'other'));

-- Add comprehensive verification fields
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS address_verified boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS employment_verified boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS income_verified boolean DEFAULT false;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS last_verification_date date;

-- ============================================================================
-- STEP 3: ENHANCE SATELLITE TABLES
-- ============================================================================

-- Enhance person_addresses table
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA';
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS latitude numeric(10,8);
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS longitude numeric(11,8);
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS address_quality_score integer CHECK (address_quality_score >= 1 AND address_quality_score <= 10);
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS address_verified boolean DEFAULT false;
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS verification_date date;
ALTER TABLE person_addresses ADD COLUMN IF NOT EXISTS verification_method text CHECK (verification_method IN ('skip_trace', 'manual', 'postal_service', 'credit_bureau', 'other'));

-- Enhance phone_numbers table
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS phone_type text DEFAULT 'mobile' CHECK (phone_type IN ('mobile', 'home', 'work', 'fax', 'other'));
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS phone_quality_score integer CHECK (phone_quality_score >= 1 AND phone_quality_score <= 10);
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS verification_date date;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS verification_method text CHECK (verification_method IN ('skip_trace', 'manual', 'carrier_lookup', 'credit_bureau', 'other'));
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS line_type text CHECK (line_type IN ('mobile', 'landline', 'voip', 'unknown'));

-- Enhance emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS email_type text DEFAULT 'personal' CHECK (email_type IN ('personal', 'work', 'school', 'other'));
ALTER TABLE emails ADD COLUMN IF NOT EXISTS email_quality_score integer CHECK (email_quality_score >= 1 AND email_quality_score <= 10);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS verification_date date;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS verification_method text CHECK (verification_method IN ('skip_trace', 'manual', 'email_validation', 'credit_bureau', 'other'));

-- Enhance relatives table
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relative_type text CHECK (relative_type IN ('spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'aunt_uncle', 'niece_nephew', 'cousin', 'other'));
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relative_ssn text;
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relative_dob date;
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relative_phone text;
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relative_email text;
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relative_employer text;
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relative_occupation text;
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relationship_quality_score integer CHECK (relationship_quality_score >= 1 AND relationship_quality_score <= 10);
ALTER TABLE relatives ADD COLUMN IF NOT EXISTS relationship_verified boolean DEFAULT false;

-- Enhance properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type text DEFAULT 'residential' CHECK (property_type IN ('residential', 'commercial', 'land', 'investment', 'vacation'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ownership_type text CHECK (ownership_type IN ('owned', 'rented', 'leased', 'mortgaged', 'unknown'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_value numeric(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mortgage_balance numeric(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_tax numeric(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_insurance numeric(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_quality_score integer CHECK (property_quality_score >= 1 AND property_quality_score <= 10);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_verified boolean DEFAULT false;

-- Enhance vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type text CHECK (vehicle_type IN ('car', 'truck', 'motorcycle', 'rv', 'boat', 'other'));
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ownership_type text CHECK (ownership_type IN ('owned', 'leased', 'financed', 'unknown'));
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS loan_balance numeric(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS monthly_payment numeric(8,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_quality_score integer CHECK (vehicle_quality_score >= 1 AND vehicle_quality_score <= 10);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_verified boolean DEFAULT false;

-- Enhance places_of_employment table
ALTER TABLE places_of_employment ADD COLUMN IF NOT EXISTS employment_type text CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'self_employed', 'unemployed', 'retired', 'student'));
ALTER TABLE places_of_employment ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE places_of_employment ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE places_of_employment ADD COLUMN IF NOT EXISTS salary numeric(10,2);
ALTER TABLE places_of_employment ADD COLUMN IF NOT EXISTS employment_quality_score integer CHECK (employment_quality_score >= 1 AND employment_quality_score <= 10);
ALTER TABLE places_of_employment ADD COLUMN IF NOT EXISTS employment_verified boolean DEFAULT false;

-- ============================================================================
-- STEP 4: CREATE NEW TABLES
-- ============================================================================

-- Create calls table for tracking collection calls
CREATE TABLE IF NOT EXISTS calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id) NOT NULL,
    collector_id uuid REFERENCES platform_users(id) NOT NULL,
    call_date timestamptz NOT NULL,
    call_duration integer, -- in seconds
    call_result text CHECK (call_result IN ('no_answer', 'left_message', 'spoke_to_debtor', 'spoke_to_relative', 'wrong_number', 'disconnected', 'do_not_call', 'promise_to_pay', 'payment_received', 'bankruptcy', 'deceased', 'other')),
    call_notes text,
    promise_amount numeric(10,2),
    promise_date date,
    next_call_date date,
    call_quality_score integer CHECK (call_quality_score >= 1 AND call_quality_score <= 10),
    created_at timestamptz DEFAULT now()
);

-- Create notes table for debtor notes
CREATE TABLE IF NOT EXISTS notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id) NOT NULL,
    user_id uuid REFERENCES platform_users(id) NOT NULL,
    note_type text DEFAULT 'general' CHECK (note_type IN ('general', 'contact', 'payment', 'promise', 'hardship', 'legal', 'skip_trace', 'other')),
    note_text text NOT NULL,
    is_private boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Create payments table for tracking payments
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id) NOT NULL,
    payment_date date NOT NULL,
    payment_amount numeric(10,2) NOT NULL,
    payment_method text CHECK (payment_method IN ('check', 'money_order', 'bank_transfer', 'credit_card', 'debit_card', 'cash', 'other')),
    payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'cleared', 'returned', 'cancelled')),
    payment_reference text,
    payment_notes text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 5: CREATE INDEXES
-- ============================================================================

-- Persons indexes
CREATE INDEX IF NOT EXISTS idx_persons_middle_name ON persons(middle_name);
CREATE INDEX IF NOT EXISTS idx_persons_maiden_name ON persons(maiden_name);
CREATE INDEX IF NOT EXISTS idx_persons_gender ON persons(gender);
CREATE INDEX IF NOT EXISTS idx_persons_marital_status ON persons(marital_status);
CREATE INDEX IF NOT EXISTS idx_persons_occupation ON persons(occupation);
CREATE INDEX IF NOT EXISTS idx_persons_employer ON persons(employer);
CREATE INDEX IF NOT EXISTS idx_persons_credit_score ON persons(credit_score);
CREATE INDEX IF NOT EXISTS idx_persons_do_not_call ON persons(do_not_call);
CREATE INDEX IF NOT EXISTS idx_persons_bankruptcy_filed ON persons(bankruptcy_filed);
CREATE INDEX IF NOT EXISTS idx_persons_active_military ON persons(active_military);

-- Debtors indexes
CREATE INDEX IF NOT EXISTS idx_debtors_account_type ON debtors(account_type);
CREATE INDEX IF NOT EXISTS idx_debtors_account_status ON debtors(account_status);
CREATE INDEX IF NOT EXISTS idx_debtors_collection_status ON debtors(collection_status);
CREATE INDEX IF NOT EXISTS idx_debtors_collection_priority ON debtors(collection_priority);
CREATE INDEX IF NOT EXISTS idx_debtors_assigned_collector_id ON debtors(assigned_collector_id);
CREATE INDEX IF NOT EXISTS idx_debtors_last_contact_date ON debtors(last_contact_date);
CREATE INDEX IF NOT EXISTS idx_debtors_next_contact_date ON debtors(next_contact_date);
CREATE INDEX IF NOT EXISTS idx_debtors_do_not_call ON debtors(do_not_call);
CREATE INDEX IF NOT EXISTS idx_debtors_bankruptcy_filed ON debtors(bankruptcy_filed);
CREATE INDEX IF NOT EXISTS idx_debtors_active_military ON debtors(active_military);
CREATE INDEX IF NOT EXISTS idx_debtors_hardship_declared ON debtors(hardship_declared);

-- Satellite table indexes
CREATE INDEX IF NOT EXISTS idx_person_addresses_quality ON person_addresses(address_quality_score);
CREATE INDEX IF NOT EXISTS idx_person_addresses_verified ON person_addresses(address_verified);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_quality ON phone_numbers(phone_quality_score);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_verified ON phone_numbers(phone_verified);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_carrier ON phone_numbers(carrier);
CREATE INDEX IF NOT EXISTS idx_emails_quality ON emails(email_quality_score);
CREATE INDEX IF NOT EXISTS idx_emails_verified ON emails(email_verified);
CREATE INDEX IF NOT EXISTS idx_relatives_type ON relatives(relative_type);
CREATE INDEX IF NOT EXISTS idx_relatives_quality ON relatives(relationship_quality_score);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_ownership ON properties(ownership_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_ownership ON vehicles(ownership_type);
CREATE INDEX IF NOT EXISTS idx_employment_type ON places_of_employment(employment_type);
CREATE INDEX IF NOT EXISTS idx_employment_quality ON places_of_employment(employment_quality_score);

-- New table indexes
CREATE INDEX IF NOT EXISTS idx_calls_debtor_id ON calls(debtor_id);
CREATE INDEX IF NOT EXISTS idx_calls_collector_id ON calls(collector_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_date ON calls(call_date);
CREATE INDEX IF NOT EXISTS idx_calls_call_result ON calls(call_result);
CREATE INDEX IF NOT EXISTS idx_calls_next_call_date ON calls(next_call_date);
CREATE INDEX IF NOT EXISTS idx_notes_debtor_id ON notes(debtor_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_note_type ON notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_debtor_id ON payments(debtor_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON payments(payment_status);

-- ============================================================================
-- STEP 6: ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Platform admin can access everything
CREATE POLICY "Platform admin full access" ON calls FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON notes FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON payments FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Agency users can view their assigned debtors' data
CREATE POLICY "Agency users can view debtor calls" ON calls FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND debtor_id IN (
        SELECT id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor notes" ON notes FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND debtor_id IN (
        SELECT id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

CREATE POLICY "Agency users can view debtor payments" ON payments FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND debtor_id IN (
        SELECT id FROM debtors 
        WHERE portfolio_id IN (
            SELECT portfolio_id FROM master_portfolio_placements 
            WHERE agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    )
);

-- ============================================================================
-- STEP 7: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get comprehensive person summary
CREATE OR REPLACE FUNCTION get_comprehensive_person_summary(p_person_id uuid)
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
        ),
        'calls', COALESCE(
            (SELECT jsonb_agg(row_to_json(c.*))
             FROM calls c
             JOIN debtors d ON c.debtor_id = d.id
             WHERE d.person_id = p_person_id),
            '[]'::jsonb
        ),
        'notes', COALESCE(
            (SELECT jsonb_agg(row_to_json(n.*))
             FROM notes n
             JOIN debtors d ON n.debtor_id = d.id
             WHERE d.person_id = p_person_id),
            '[]'::jsonb
        ),
        'payments', COALESCE(
            (SELECT jsonb_agg(row_to_json(pay.*))
             FROM payments pay
             JOIN debtors d ON pay.debtor_id = d.id
             WHERE d.person_id = p_person_id),
            '[]'::jsonb
        )
    ) INTO v_result
    FROM persons p
    WHERE p.id = p_person_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 