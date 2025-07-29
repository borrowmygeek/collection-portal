-- Sales Module Database Schema (Fixed Version)
-- Run this directly in the Supabase SQL Editor

-- =============================================
-- BUYER MANAGEMENT
-- =============================================

CREATE TABLE IF NOT EXISTS master_buyers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Company Information
    company_name text NOT NULL,
    company_type text CHECK (company_type IN ('debt_buyer', 'collection_agency', 'law_firm', 'investor', 'other')),
    tax_id text,
    website text,
    
    -- Contact Information
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    address text,
    city text,
    state text,
    zipcode text,
    
    -- Business Details
    years_in_business integer,
    annual_revenue numeric(15,2),
    investment_capacity numeric(15,2),
    preferred_portfolio_types text[],
    geographic_focus text[],
    
    -- NDA and Approval Status
    nda_signed boolean DEFAULT false,
    nda_signed_at timestamptz,
    nda_version text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
    
    -- Metadata
    ip_address inet,
    user_agent text,
    notes text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- NDA AGREEMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS nda_agreements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id uuid REFERENCES master_buyers(id) ON DELETE CASCADE,
    
    -- Agreement Details
    agreement_text text NOT NULL,
    version text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    
    -- Acceptance Details
    accepted_at timestamptz,
    ip_address inet,
    user_agent text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- PORTFOLIO SALES
-- =============================================

CREATE TABLE IF NOT EXISTS portfolio_sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id uuid REFERENCES master_portfolios(id) ON DELETE CASCADE,
    client_id uuid REFERENCES master_clients(id) ON DELETE CASCADE,
    seller_id uuid REFERENCES master_clients(id) ON DELETE CASCADE,
    
    -- Sale Details
    asking_price numeric(12,2) NOT NULL,
    minimum_offer numeric(12,2),
    sale_notes text,
    key_highlights text[],
    restrictions text[],
    
    -- Status and Timing
    sale_status text DEFAULT 'available' CHECK (sale_status IN ('available', 'pending', 'sold', 'expired', 'cancelled')),
    expires_at timestamptz,
    
    -- Metadata
    created_by uuid REFERENCES auth.users(id),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- PORTFOLIO SALE STATISTICS
-- =============================================

CREATE TABLE IF NOT EXISTS portfolio_sale_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_sale_id uuid REFERENCES portfolio_sales(id) ON DELETE CASCADE,
    
    -- Account Statistics
    total_accounts integer NOT NULL,
    total_balance numeric(12,2) NOT NULL,
    average_balance numeric(10,2) NOT NULL,
    median_balance numeric(10,2),
    
    -- Demographic Statistics
    state_distribution jsonb,
    client_distribution jsonb,
    account_type_distribution jsonb,
    balance_range_distribution jsonb,
    
    -- Temporal Statistics
    charge_off_date_distribution jsonb,
    debt_age_distribution jsonb,
    credit_score_distribution jsonb,
    
    -- Collection Statistics
    average_charge_off_date date,
    average_debt_age_months integer,
    average_credit_score integer,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(portfolio_sale_id)
);

-- =============================================
-- SALE VIEWS AND INTEREST TRACKING
-- =============================================

CREATE TABLE IF NOT EXISTS sale_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_sale_id uuid REFERENCES portfolio_sales(id) ON DELETE CASCADE,
    buyer_id uuid REFERENCES master_buyers(id) ON DELETE CASCADE,
    
    -- View Details
    view_duration_seconds integer,
    pages_viewed text[],
    
    -- Metadata
    ip_address inet,
    user_agent text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- SALE INQUIRIES
-- =============================================

CREATE TABLE IF NOT EXISTS sale_inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_sale_id uuid REFERENCES portfolio_sales(id) ON DELETE CASCADE,
    buyer_id uuid REFERENCES master_buyers(id) ON DELETE CASCADE,
    
    -- Inquiry Details
    inquiry_type text CHECK (inquiry_type IN ('question', 'offer', 'request_info', 'schedule_call')),
    subject text,
    message text NOT NULL,
    offer_amount numeric(12,2),
    
    -- Status
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'accepted', 'declined', 'closed')),
    response text,
    responded_by uuid REFERENCES auth.users(id),
    responded_at timestamptz,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Buyer indexes
CREATE INDEX IF NOT EXISTS idx_master_buyers_user_id ON master_buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_master_buyers_status ON master_buyers(status);
CREATE INDEX IF NOT EXISTS idx_master_buyers_nda_signed ON master_buyers(nda_signed);

-- NDA indexes
CREATE INDEX IF NOT EXISTS idx_nda_agreements_buyer_id ON nda_agreements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_nda_agreements_status ON nda_agreements(status);

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_sales_status ON portfolio_sales(sale_status);
CREATE INDEX IF NOT EXISTS idx_portfolio_sales_portfolio_id ON portfolio_sales(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_sales_client_id ON portfolio_sales(client_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_sales_created_at ON portfolio_sales(created_at);

-- Stats indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_sale_stats_sale_id ON portfolio_sale_stats(portfolio_sale_id);

-- Views indexes
CREATE INDEX IF NOT EXISTS idx_sale_views_sale_id ON sale_views(portfolio_sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_views_buyer_id ON sale_views(buyer_id);

-- Inquiries indexes
CREATE INDEX IF NOT EXISTS idx_sale_inquiries_sale_id ON sale_inquiries(portfolio_sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_inquiries_buyer_id ON sale_inquiries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sale_inquiries_status ON sale_inquiries(status);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE master_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE nda_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_sale_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_inquiries ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own data
CREATE POLICY "Buyers can view own data" ON master_buyers
    FOR SELECT USING (auth.uid() = user_id);

-- Buyers can update their own data
CREATE POLICY "Buyers can update own data" ON master_buyers
    FOR UPDATE USING (auth.uid() = user_id);

-- Platform admins can view all buyers
CREATE POLICY "Platform admins can view all buyers" ON master_buyers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    );

-- Buyers with signed NDA can view available portfolio sales
CREATE POLICY "Buyers with NDA can view available sales" ON portfolio_sales
    FOR SELECT USING (
        sale_status = 'available' AND
        EXISTS (
            SELECT 1 FROM master_buyers 
            WHERE master_buyers.user_id = auth.uid() 
            AND master_buyers.nda_signed = true
            AND master_buyers.status = 'approved'
        )
    );

-- Platform admins can manage all portfolio sales
CREATE POLICY "Platform admins can manage all sales" ON portfolio_sales
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    );

-- Buyers can view stats for available sales
CREATE POLICY "Buyers can view available sale stats" ON portfolio_sale_stats
    FOR SELECT USING (
        portfolio_sale_id IN (
            SELECT id FROM portfolio_sales 
            WHERE sale_status = 'available'
        ) AND
        EXISTS (
            SELECT 1 FROM master_buyers 
            WHERE master_buyers.user_id = auth.uid() 
            AND master_buyers.nda_signed = true
            AND master_buyers.status = 'approved'
        )
    );

-- Buyers can create inquiries for available sales
CREATE POLICY "Buyers can create inquiries" ON sale_inquiries
    FOR INSERT WITH CHECK (
        portfolio_sale_id IN (
            SELECT id FROM portfolio_sales 
            WHERE sale_status = 'available'
        ) AND
        buyer_id IN (
            SELECT id FROM master_buyers 
            WHERE user_id = auth.uid()
        )
    );

-- Buyers can view their own inquiries
CREATE POLICY "Buyers can view own inquiries" ON sale_inquiries
    FOR SELECT USING (
        buyer_id IN (
            SELECT id FROM master_buyers 
            WHERE user_id = auth.uid()
        )
    );

-- =============================================
-- FUNCTIONS FOR STATISTICS COMPUTATION
-- =============================================

-- Function to compute portfolio sale statistics
CREATE OR REPLACE FUNCTION compute_portfolio_sale_stats(sale_id UUID)
RETURNS VOID AS $$
DECLARE
    portfolio_uuid UUID;
    stats_record RECORD;
BEGIN
    -- Get the portfolio ID for this sale
    SELECT portfolio_id INTO portfolio_uuid 
    FROM portfolio_sales 
    WHERE id = sale_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Portfolio sale not found: %', sale_id;
    END IF;
    
    -- Compute statistics from the portfolio data
    -- This is a simplified version - in practice, you'd compute from actual debtor data
    INSERT INTO portfolio_sale_stats (
        portfolio_sale_id,
        total_accounts,
        total_balance,
        average_balance,
        median_balance,
        state_distribution,
        client_distribution,
        account_type_distribution,
        balance_range_distribution,
        charge_off_date_distribution,
        debt_age_distribution,
        credit_score_distribution,
        average_charge_off_date,
        average_debt_age_months,
        average_credit_score
    )
    SELECT 
        sale_id,
        COALESCE(p.account_count, 0),
        COALESCE(p.original_balance, 0),
        COALESCE(p.average_balance, 0),
        COALESCE(p.average_balance, 0), -- Simplified median
        '{}'::jsonb, -- Placeholder for state distribution
        '{}'::jsonb, -- Placeholder for client distribution
        '{}'::jsonb, -- Placeholder for account type distribution
        '{}'::jsonb, -- Placeholder for balance range distribution
        '{}'::jsonb, -- Placeholder for charge-off date distribution
        '{}'::jsonb, -- Placeholder for debt age distribution
        '{}'::jsonb, -- Placeholder for credit score distribution
        p.charge_off_date,
        p.debt_age_months,
        650 -- Placeholder average credit score
    FROM master_portfolios p
    WHERE p.id = portfolio_uuid
    ON CONFLICT (portfolio_sale_id) DO UPDATE SET
        total_accounts = EXCLUDED.total_accounts,
        total_balance = EXCLUDED.total_balance,
        average_balance = EXCLUDED.average_balance,
        median_balance = EXCLUDED.median_balance,
        state_distribution = EXCLUDED.state_distribution,
        client_distribution = EXCLUDED.client_distribution,
        account_type_distribution = EXCLUDED.account_type_distribution,
        balance_range_distribution = EXCLUDED.balance_range_distribution,
        charge_off_date_distribution = EXCLUDED.charge_off_date_distribution,
        debt_age_distribution = EXCLUDED.debt_age_distribution,
        credit_score_distribution = EXCLUDED.credit_score_distribution,
        average_charge_off_date = EXCLUDED.average_charge_off_date,
        average_debt_age_months = EXCLUDED.average_debt_age_months,
        average_credit_score = EXCLUDED.average_credit_score,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS FOR AUTOMATIC STATISTICS UPDATES
-- =============================================

-- Function to trigger statistics updates
CREATE OR REPLACE FUNCTION trigger_update_sale_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM compute_portfolio_sale_stats(NEW.id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM portfolio_sale_stats WHERE portfolio_sale_id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update statistics when sales are created/updated
CREATE TRIGGER update_sale_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_sales
    FOR EACH ROW EXECUTE FUNCTION trigger_update_sale_stats(); 