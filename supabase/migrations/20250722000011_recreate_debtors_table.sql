-- Recreate debtors table with better organization and missing fields
-- Since there's no data to preserve, we can simply drop and recreate

-- Drop existing table and dependencies
DROP TABLE IF EXISTS debtors CASCADE;

-- Recreate debtors table with organized fields
CREATE TABLE debtors (
    -- UUID fields (primary keys and foreign keys)
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid REFERENCES persons(id) ON DELETE SET NULL,
    portfolio_id uuid NOT NULL REFERENCES master_portfolios(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES master_clients(id) ON DELETE CASCADE,
    assigned_collector_id uuid REFERENCES platform_users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES platform_users(id) ON DELETE SET NULL,
    
    -- Account identification fields
    account_number text,
    original_account_number text,
    external_id text,
    import_batch_id text,
    
    -- Creditor information
    original_creditor text,
    original_creditor_name text,
    
    -- Balance and financial fields
    original_balance numeric(15,2) NOT NULL DEFAULT 0,
    current_balance numeric(15,2) NOT NULL DEFAULT 0,
    last_payment_amount numeric(15,2),
    promise_to_pay_amount numeric(15,2),
    settlement_offered numeric(15,2),
    interest_rate numeric(5,2),
    late_fees numeric(15,2),
    collection_fees numeric(15,2),
    legal_fees numeric(15,2),
    total_fees numeric(15,2),
    payment_plan_amount numeric(15,2),
    processing_fee numeric(15,2),
    
    -- Account type and status fields
    account_type text CHECK (account_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'student_loan', 'business_loan', 'other')),
    account_subtype text,
    account_status text CHECK (account_status IN ('active', 'inactive', 'resolved', 'returned', 'bankruptcy', 'deceased', 'settled', 'paid_in_full')),
    
    -- Date fields
    charge_off_date date,
    date_opened date,
    last_activity_date date,
    last_payment_date date,
    promise_to_pay_date date,
    next_payment_date date,
    assigned_date timestamp with time zone,
    last_contact_date timestamp with time zone,
    next_contact_date timestamp with time zone,
    last_skip_trace_date timestamp with time zone,
    
    -- Collection status and priority
    status text CHECK (status IN ('new', 'contacted', 'promise_to_pay', 'payment_received', 'resolved', 'do_not_call', 'bankruptcy', 'deceased')),
    collection_status text CHECK (collection_status IN ('new', 'contacted', 'promise_to_pay', 'payment_received', 'resolved', 'do_not_call', 'bankruptcy', 'deceased', 'settled', 'paid_in_full', 'returned')),
    collection_priority text CHECK (collection_priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Contact and communication fields
    contact_method text CHECK (contact_method IN ('phone', 'email', 'mail', 'text', 'in_person')),
    contact_result text,
    contact_notes text,
    payment_plan_frequency text,
    payment_frequency text CHECK (payment_frequency IN ('one_time', 'monthly', 'bi_weekly', 'weekly', 'irregular')),
    
    -- Payment tracking fields
    total_payments numeric(15,2) DEFAULT 0,
    payment_count integer DEFAULT 0,
    average_payment numeric(15,2),
    largest_payment numeric(15,2),
    
    -- Compliance and flags
    do_not_call boolean DEFAULT false,
    hardship_declared boolean DEFAULT false,
    hardship_type text CHECK (hardship_type IN ('medical', 'unemployment', 'disability', 'natural_disaster', 'other')),
    settlement_accepted boolean DEFAULT false,
    
    -- Data quality and source fields
    data_source text,
    skip_trace_quality_score numeric(3,2),
    notes text,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_debtors_person_id ON debtors(person_id);
CREATE INDEX IF NOT EXISTS idx_debtors_portfolio_id ON debtors(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_debtors_client_id ON debtors(client_id);
CREATE INDEX IF NOT EXISTS idx_debtors_account_number ON debtors(account_number);
CREATE INDEX IF NOT EXISTS idx_debtors_original_account_number ON debtors(original_account_number);
CREATE INDEX IF NOT EXISTS idx_debtors_external_id ON debtors(external_id);
CREATE INDEX IF NOT EXISTS idx_debtors_created_by ON debtors(created_by);
CREATE INDEX IF NOT EXISTS idx_debtors_assigned_collector_id ON debtors(assigned_collector_id);
CREATE INDEX IF NOT EXISTS idx_debtors_status ON debtors(status);
CREATE INDEX IF NOT EXISTS idx_debtors_collection_status ON debtors(collection_status);
CREATE INDEX IF NOT EXISTS idx_debtors_charge_off_date ON debtors(charge_off_date);
CREATE INDEX IF NOT EXISTS idx_debtors_current_balance ON debtors(current_balance);
CREATE INDEX IF NOT EXISTS idx_debtors_import_batch_id ON debtors(import_batch_id);

-- Enable Row Level Security
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view debtors they created
CREATE POLICY "Users can view debtors they created" ON debtors
    FOR SELECT USING (auth.uid() = created_by);

-- Users can create debtors
CREATE POLICY "Users can create debtors" ON debtors
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update debtors they created
CREATE POLICY "Users can update debtors they created" ON debtors
    FOR UPDATE USING (auth.uid() = created_by);

-- Platform admins can view all debtors
CREATE POLICY "Platform admins can view all debtors" ON debtors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    );

-- Agency users can view debtors in their portfolios (simplified)
CREATE POLICY "Agency users can view debtors in their portfolios" ON debtors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_users pu
            WHERE pu.auth_user_id = auth.uid()
            AND pu.role IN ('agency_admin', 'agency_user')
        )
    );

-- Agency users can update debtors in their portfolios (simplified)
CREATE POLICY "Agency users can update debtors in their portfolios" ON debtors
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM platform_users pu
            WHERE pu.auth_user_id = auth.uid()
            AND pu.role IN ('agency_admin', 'agency_user')
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_debtors_updated_at BEFORE UPDATE ON debtors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 