-- Import System Database Schema

-- =============================================
-- IMPORT TEMPLATES
-- =============================================

CREATE TABLE IF NOT EXISTS import_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template Information
    name text NOT NULL,
    import_type text NOT NULL CHECK (import_type IN ('portfolios', 'accounts', 'debtors', 'clients', 'agencies')),
    description text,
    
    -- Column Configuration
    required_columns text[] NOT NULL,
    optional_columns text[] DEFAULT '{}',
    sample_data jsonb DEFAULT '[]',
    validation_rules jsonb DEFAULT '[]',
    
    -- Metadata
    created_by uuid REFERENCES auth.users(id),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- IMPORT JOBS
-- =============================================

CREATE TABLE IF NOT EXISTS import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File Information
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    file_type text NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'xls')),
    file_path text,
    
    -- Import Configuration
    import_type text NOT NULL CHECK (import_type IN ('portfolios', 'accounts', 'debtors', 'clients', 'agencies')),
    template_id uuid REFERENCES import_templates(id),
    
    -- Processing Status
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Results
    total_rows integer DEFAULT 0,
    processed_rows integer DEFAULT 0,
    successful_rows integer DEFAULT 0,
    failed_rows integer DEFAULT 0,
    errors jsonb DEFAULT '[]',
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Import jobs indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_import_type ON import_jobs(import_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at);

-- Import templates indexes
CREATE INDEX IF NOT EXISTS idx_import_templates_import_type ON import_templates(import_type);
CREATE INDEX IF NOT EXISTS idx_import_templates_created_by ON import_templates(created_by);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own import jobs
CREATE POLICY "Users can view own import jobs" ON import_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own import jobs
CREATE POLICY "Users can create own import jobs" ON import_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own import jobs
CREATE POLICY "Users can update own import jobs" ON import_jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- Platform admins can view all import jobs
CREATE POLICY "Platform admins can view all import jobs" ON import_jobs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    );

-- Platform admins can manage all templates
CREATE POLICY "Platform admins can manage all templates" ON import_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    );

-- Users can view all templates
CREATE POLICY "Users can view all templates" ON import_templates
    FOR SELECT USING (true);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at timestamp on import_jobs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_import_jobs_updated_at BEFORE UPDATE ON import_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_templates_updated_at BEFORE UPDATE ON import_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Portfolio Import Template
INSERT INTO import_templates (
    name,
    import_type,
    description,
    required_columns,
    optional_columns,
    sample_data,
    validation_rules
) VALUES (
    'Standard Portfolio Import',
    'portfolios',
    'Import portfolios with basic information including client code, balance, and account count',
    ARRAY['name', 'client_code', 'original_balance', 'account_count'],
    ARRAY['description', 'portfolio_type', 'charge_off_date', 'debt_age_months', 'average_balance', 'geographic_focus', 'credit_score_range', 'status'],
    '[
        {
            "name": "Sample Portfolio 1",
            "client_code": "CLIENT001",
            "original_balance": "1000000.00",
            "account_count": "5000",
            "description": "Credit card portfolio from Q1 2024",
            "portfolio_type": "credit_card",
            "charge_off_date": "2024-01-15",
            "debt_age_months": "6",
            "average_balance": "200.00",
            "geographic_focus": "TX,CA,FL",
            "credit_score_range": "500-650",
            "status": "active"
        }
    ]'::jsonb,
    '[
        {
            "column": "original_balance",
            "rule": "numeric",
            "message": "Original balance must be a valid number"
        },
        {
            "column": "account_count",
            "rule": "integer",
            "message": "Account count must be a valid integer"
        },
        {
            "column": "client_code",
            "rule": "required",
            "message": "Client code is required"
        }
    ]'::jsonb
);

-- Client Import Template
INSERT INTO import_templates (
    name,
    import_type,
    description,
    required_columns,
    optional_columns,
    sample_data,
    validation_rules
) VALUES (
    'Standard Client Import',
    'clients',
    'Import clients with basic information including name, code, and contact details',
    ARRAY['name', 'code'],
    ARRAY['contact_name', 'contact_email', 'contact_phone', 'address', 'address_line2', 'city', 'state', 'zipcode', 'client_type', 'status'],
    '[
        {
            "name": "Sample Client Corp",
            "code": "CLIENT001",
            "contact_name": "John Doe",
            "contact_email": "john.doe@sampleclient.com",
            "contact_phone": "(555) 123-4567",
            "address": "123 Main St",
            "address_line2": "Suite 100",
            "city": "Austin",
            "state": "TX",
            "zipcode": "78701",
            "client_type": "creditor",
            "status": "active"
        }
    ]'::jsonb,
    '[
        {
            "column": "code",
            "rule": "unique",
            "message": "Client code must be unique"
        },
        {
            "column": "contact_email",
            "rule": "email",
            "message": "Contact email must be a valid email address"
        }
    ]'::jsonb
);

-- Agency Import Template
INSERT INTO import_templates (
    name,
    import_type,
    description,
    required_columns,
    optional_columns,
    sample_data,
    validation_rules
) VALUES (
    'Standard Agency Import',
    'agencies',
    'Import agencies with basic information including name, code, and instance details',
    ARRAY['name', 'code', 'instance_id', 'contact_email'],
    ARRAY['instance_url', 'instance_anon_key', 'instance_service_key', 'contact_name', 'contact_phone', 'address', 'address_line2', 'city', 'state', 'zipcode', 'subscription_tier', 'subscription_status', 'subscription_start_date', 'subscription_end_date', 'billing_cycle', 'base_monthly_fee', 'max_users', 'max_portfolios', 'max_debtors', 'storage_limit_gb', 'status'],
    '[
        {
            "name": "Sample Agency LLC",
            "code": "AGENCY001",
            "instance_id": "sample-instance-id",
            "contact_email": "admin@sampleagency.com",
            "instance_url": "https://sample-instance.supabase.co",
            "contact_name": "Jane Smith",
            "contact_phone": "(555) 987-6543",
            "address": "456 Business Ave",
            "city": "Dallas",
            "state": "TX",
            "zipcode": "75201",
            "subscription_tier": "premium",
            "subscription_status": "active",
            "base_monthly_fee": "299.00",
            "max_users": "25",
            "max_portfolios": "500",
            "max_debtors": "50000",
            "storage_limit_gb": "50",
            "status": "active"
        }
    ]'::jsonb,
    '[
        {
            "column": "code",
            "rule": "unique",
            "message": "Agency code must be unique"
        },
        {
            "column": "contact_email",
            "rule": "email",
            "message": "Contact email must be a valid email address"
        },
        {
            "column": "base_monthly_fee",
            "rule": "numeric",
            "message": "Base monthly fee must be a valid number"
        }
    ]'::jsonb
); 