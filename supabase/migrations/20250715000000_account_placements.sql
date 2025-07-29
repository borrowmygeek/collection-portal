-- Account-Level Placement Tracking Migration
-- This allows portfolios to be split across multiple agencies and tracks individual account placement status

-- ============================================================================
-- ACCOUNT MANAGEMENT
-- ============================================================================

CREATE TABLE master_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid REFERENCES master_portfolios(id) NOT NULL,
    client_id uuid REFERENCES master_clients(id) NOT NULL,
    
    -- Account Information
    account_number text NOT NULL,
    original_creditor text,
    original_balance numeric(12,2) NOT NULL,
    current_balance numeric(12,2) NOT NULL,
    charge_off_date date,
    date_opened date,
    
    -- Account Details
    account_type text DEFAULT 'credit_card' CHECK (account_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'other')),
    debt_age_months integer,
    geographic_state text,
    credit_score_range text,
    
    -- Status
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'resolved', 'returned')),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(portfolio_id, account_number) -- Each account number is unique within a portfolio
);

-- ============================================================================
-- ACCOUNT PLACEMENTS
-- ============================================================================

CREATE TABLE master_account_placements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid REFERENCES master_accounts(id) NOT NULL,
    portfolio_id uuid REFERENCES master_portfolios(id) NOT NULL,
    agency_id uuid REFERENCES master_agencies(id) NOT NULL,
    client_id uuid REFERENCES master_clients(id) NOT NULL,
    
    -- Placement Details
    placement_date date NOT NULL,
    return_date date,
    placement_amount numeric(12,2) NOT NULL,
    
    -- Terms
    contingency_rate numeric(3,2) NOT NULL CHECK (contingency_rate >= 0 AND contingency_rate <= 1),
    min_settlement_rate numeric(3,2) NOT NULL CHECK (min_settlement_rate >= 0 AND min_settlement_rate <= 1),
    flat_fee_rate numeric(10,2),
    
    -- Placement Status
    placement_status text DEFAULT 'new' CHECK (placement_status IN ('new', 'placed', 'recalled', 'closed')),
    
    -- Collection Status (from agency instance)
    collection_status text DEFAULT 'new' CHECK (collection_status IN ('new', 'contacted', 'promise_to_pay', 'payment_received', 'resolved', 'do_not_call', 'bankruptcy', 'deceased')),
    
    -- Performance Tracking
    total_collected numeric(12,2) DEFAULT 0,
    last_payment_date date,
    last_activity_date date,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Account indexes
CREATE INDEX idx_master_accounts_portfolio_id ON master_accounts(portfolio_id);
CREATE INDEX idx_master_accounts_client_id ON master_accounts(client_id);
CREATE INDEX idx_master_accounts_status ON master_accounts(status);
CREATE INDEX idx_master_accounts_account_number ON master_accounts(account_number);
CREATE INDEX idx_master_accounts_charge_off_date ON master_accounts(charge_off_date);

-- Account placement indexes
CREATE INDEX idx_master_account_placements_account_id ON master_account_placements(account_id);
CREATE INDEX idx_master_account_placements_portfolio_id ON master_account_placements(portfolio_id);
CREATE INDEX idx_master_account_placements_agency_id ON master_account_placements(agency_id);
CREATE INDEX idx_master_account_placements_client_id ON master_account_placements(client_id);
CREATE INDEX idx_master_account_placements_placement_status ON master_account_placements(placement_status);
CREATE INDEX idx_master_account_placements_collection_status ON master_account_placements(collection_status);
CREATE INDEX idx_master_account_placements_placement_date ON master_account_placements(placement_date);
CREATE INDEX idx_master_account_placements_return_date ON master_account_placements(return_date);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps for new tables
CREATE TRIGGER update_master_accounts_updated_at BEFORE UPDATE ON master_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_account_placements_updated_at BEFORE UPDATE ON master_account_placements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE master_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_account_placements ENABLE ROW LEVEL SECURITY;

-- Platform admin can access everything
CREATE POLICY "Platform admin full access" ON master_accounts FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON master_account_placements FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get account placement summary for a portfolio
CREATE OR REPLACE FUNCTION get_portfolio_placement_summary(portfolio_uuid uuid)
RETURNS TABLE (
    total_accounts bigint,
    placed_accounts bigint,
    active_placements bigint,
    total_placement_value numeric,
    total_collected_value numeric,
    completion_rate numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT a.id)::bigint as total_accounts,
        COUNT(DISTINCT CASE WHEN ap.placement_status IN ('placed', 'new') THEN a.id END)::bigint as placed_accounts,
        COUNT(DISTINCT CASE WHEN ap.placement_status = 'placed' THEN a.id END)::bigint as active_placements,
        COALESCE(SUM(ap.placement_amount), 0) as total_placement_value,
        COALESCE(SUM(ap.total_collected), 0) as total_collected_value,
        CASE 
            WHEN SUM(ap.placement_amount) > 0 
            THEN (SUM(ap.total_collected) / SUM(ap.placement_amount))::numeric(5,4)
            ELSE 0::numeric(5,4)
        END as completion_rate
    FROM master_accounts a
    LEFT JOIN master_account_placements ap ON a.id = ap.account_id
    WHERE a.portfolio_id = portfolio_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get agency placement summary
CREATE OR REPLACE FUNCTION get_agency_placement_summary(agency_uuid uuid)
RETURNS TABLE (
    total_placements bigint,
    active_placements bigint,
    total_placement_value numeric,
    total_collected_value numeric,
    completion_rate numeric,
    avg_contingency_rate numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint as total_placements,
        COUNT(CASE WHEN placement_status = 'placed' THEN 1 END)::bigint as active_placements,
        COALESCE(SUM(placement_amount), 0) as total_placement_value,
        COALESCE(SUM(total_collected), 0) as total_collected_value,
        CASE 
            WHEN SUM(placement_amount) > 0 
            THEN (SUM(total_collected) / SUM(placement_amount))::numeric(5,4)
            ELSE 0::numeric(5,4)
        END as completion_rate,
        AVG(contingency_rate)::numeric(5,4) as avg_contingency_rate
    FROM master_account_placements
    WHERE agency_id = agency_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 