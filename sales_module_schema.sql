-- Sales Module Database Schema
-- Collection Portal - Portfolio Sales Feature

-- =============================================
-- BUYERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS master_buyers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL UNIQUE,
    contact_phone VARCHAR(50),
    website VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    nda_signed BOOLEAN DEFAULT FALSE,
    nda_signed_date TIMESTAMP WITH TIME ZONE,
    nda_ip_address INET,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'inactive')),
    verification_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- NDA AGREEMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS nda_agreements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES master_buyers(id) ON DELETE CASCADE,
    agreement_version VARCHAR(20) DEFAULT '1.0',
    agreement_text TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked'))
);

-- =============================================
-- PORTFOLIO SALES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS portfolio_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_id UUID REFERENCES master_portfolios(id) ON DELETE CASCADE,
    client_id UUID REFERENCES master_clients(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES master_clients(id) ON DELETE CASCADE,
    sale_status VARCHAR(50) DEFAULT 'available' CHECK (sale_status IN ('available', 'pending', 'sold', 'withdrawn')),
    asking_price DECIMAL(15,2),
    minimum_offer DECIMAL(15,2),
    sale_notes TEXT,
    key_highlights TEXT,
    restrictions TEXT,
    due_diligence_package_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- PORTFOLIO SALE STATISTICS (Pre-computed)
-- =============================================
CREATE TABLE IF NOT EXISTS portfolio_sale_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_sale_id UUID REFERENCES portfolio_sales(id) ON DELETE CASCADE,
    total_accounts INTEGER DEFAULT 0,
    total_balance DECIMAL(15,2) DEFAULT 0,
    average_balance DECIMAL(15,2) DEFAULT 0,
    average_charge_off_date DATE,
    average_debt_age_months INTEGER,
    average_credit_score INTEGER,
    state_distribution JSONB,
    client_distribution JSONB,
    account_type_distribution JSONB,
    balance_range_distribution JSONB,
    charge_off_date_distribution JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SALE VIEWS (Buyer access)
-- =============================================
CREATE TABLE IF NOT EXISTS sale_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_sale_id UUID REFERENCES portfolio_sales(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES master_buyers(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- =============================================
-- SALE INQUIRIES
-- =============================================
CREATE TABLE IF NOT EXISTS sale_inquiries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_sale_id UUID REFERENCES portfolio_sales(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES master_buyers(id) ON DELETE CASCADE,
    inquiry_type VARCHAR(50) CHECK (inquiry_type IN ('question', 'offer', 'nda_request', 'due_diligence')),
    message TEXT NOT NULL,
    contact_preference VARCHAR(50) DEFAULT 'email',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_master_buyers_user_id ON master_buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_master_buyers_status ON master_buyers(status);
CREATE INDEX IF NOT EXISTS idx_master_buyers_nda_signed ON master_buyers(nda_signed);

CREATE INDEX IF NOT EXISTS idx_nda_agreements_buyer_id ON nda_agreements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_nda_agreements_status ON nda_agreements(status);

CREATE INDEX IF NOT EXISTS idx_portfolio_sales_status ON portfolio_sales(sale_status);
CREATE INDEX IF NOT EXISTS idx_portfolio_sales_portfolio_id ON portfolio_sales(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_sales_client_id ON portfolio_sales(client_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_sales_created_at ON portfolio_sales(created_at);

CREATE INDEX IF NOT EXISTS idx_portfolio_sale_stats_sale_id ON portfolio_sale_stats(portfolio_sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_views_sale_id ON sale_views(portfolio_sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_views_buyer_id ON sale_views(buyer_id);

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

-- Clients can manage their own portfolio sales
CREATE POLICY "Clients can manage own portfolio sales" ON portfolio_sales
    FOR ALL USING (
        seller_id IN (
            SELECT id FROM master_clients 
            WHERE user_id = auth.uid()
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
    
    -- Compute statistics
    SELECT 
        COUNT(*) as total_accounts,
        SUM(current_balance) as total_balance,
        AVG(current_balance) as average_balance,
        AVG(EXTRACT(YEAR FROM charge_off_date)) as avg_charge_off_year,
        AVG(EXTRACT(MONTH FROM charge_off_date)) as avg_charge_off_month,
        AVG(EXTRACT(DAY FROM charge_off_date)) as avg_charge_off_day,
        AVG(debt_age_months) as average_debt_age_months,
        AVG(credit_score_range) as average_credit_score
    INTO stats_record
    FROM master_accounts 
    WHERE portfolio_id = portfolio_uuid;
    
    -- Upsert the statistics
    INSERT INTO portfolio_sale_stats (
        portfolio_sale_id,
        total_accounts,
        total_balance,
        average_balance,
        average_charge_off_date,
        average_debt_age_months,
        average_credit_score,
        last_updated
    ) VALUES (
        sale_id,
        stats_record.total_accounts,
        stats_record.total_balance,
        stats_record.average_balance,
        CASE 
            WHEN stats_record.avg_charge_off_year IS NOT NULL 
            THEN MAKE_DATE(stats_record.avg_charge_off_year::INT, 
                          stats_record.avg_charge_off_month::INT, 
                          stats_record.avg_charge_off_day::INT)
            ELSE NULL
        END,
        stats_record.average_debt_age_months,
        stats_record.average_credit_score,
        NOW()
    )
    ON CONFLICT (portfolio_sale_id) 
    DO UPDATE SET
        total_accounts = EXCLUDED.total_accounts,
        total_balance = EXCLUDED.total_balance,
        average_balance = EXCLUDED.average_balance,
        average_charge_off_date = EXCLUDED.average_charge_off_date,
        average_debt_age_months = EXCLUDED.average_debt_age_months,
        average_credit_score = EXCLUDED.average_credit_score,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS FOR AUTOMATIC STATISTICS UPDATES
-- =============================================

-- Trigger to update statistics when portfolio sales are created/updated
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

CREATE TRIGGER update_sale_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_sales
    FOR EACH ROW EXECUTE FUNCTION trigger_update_sale_stats();

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE master_buyers IS 'Buyers who can access portfolio sales after signing NDA';
COMMENT ON TABLE nda_agreements IS 'Non-disclosure agreements signed by buyers';
COMMENT ON TABLE portfolio_sales IS 'Portfolios marked for sale by clients';
COMMENT ON TABLE portfolio_sale_stats IS 'Pre-computed statistics for portfolio sales';
COMMENT ON TABLE sale_views IS 'Track buyer views of portfolio sales';
COMMENT ON TABLE sale_inquiries IS 'Inquiries from buyers about portfolio sales'; 