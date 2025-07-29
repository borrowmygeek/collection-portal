-- Import System Database Schema

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

-- Platform admins can manage all import templates
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

-- Update timestamps
CREATE TRIGGER update_import_jobs_updated_at BEFORE UPDATE ON import_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_templates_updated_at BEFORE UPDATE ON import_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- STORAGE BUCKET FOR IMPORT FILES
-- =============================================

-- Create storage bucket for import files (if it doesn't exist)
-- Note: This requires the storage extension to be enabled
INSERT INTO storage.buckets (id, name, public)
VALUES ('import-files', 'import-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for import files
CREATE POLICY "Users can upload their own import files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'import-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view their own import files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'import-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own import files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'import-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Platform admins can access all import files
CREATE POLICY "Platform admins can access all import files" ON storage.objects
    FOR ALL USING (
        bucket_id = 'import-files' AND
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    );

-- =============================================
-- DEFAULT TEMPLATES
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
    'Import portfolios with basic information',
    ARRAY['name', 'client_code', 'original_balance', 'account_count'],
    ARRAY['description', 'portfolio_type', 'charge_off_date', 'debt_age_months', 'average_balance', 'geographic_focus', 'credit_score_range', 'status'],
    '[
        {
            "name": "Sample Portfolio 1",
            "client_code": "CLIENT001",
            "original_balance": "100000.00",
            "account_count": "500",
            "description": "Credit card portfolio",
            "portfolio_type": "credit_card",
            "charge_off_date": "2024-01-15",
            "debt_age_months": "12",
            "average_balance": "200.00",
            "geographic_focus": "CA,TX,FL",
            "credit_score_range": "600-700",
            "status": "active"
        }
    ]'::jsonb,
    '[
        {
            "column": "name",
            "type": "required",
            "message": "Portfolio name is required"
        },
        {
            "column": "client_code",
            "type": "required",
            "message": "Client code is required"
        },
        {
            "column": "original_balance",
            "type": "number",
            "message": "Original balance must be a number"
        },
        {
            "column": "account_count",
            "type": "number",
            "message": "Account count must be a number"
        },
        {
            "column": "portfolio_type",
            "type": "enum",
            "message": "Portfolio type must be one of: credit_card, medical, personal_loan, auto_loan, mortgage, utility, other",
            "options": ["credit_card", "medical", "personal_loan", "auto_loan", "mortgage", "utility", "other"]
        }
    ]'::jsonb
) ON CONFLICT DO NOTHING;

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
    'Import clients with contact information',
    ARRAY['name', 'code'],
    ARRAY['contact_name', 'contact_email', 'contact_phone', 'address', 'city', 'state', 'zipcode', 'client_type', 'industry', 'website', 'tax_id', 'dba_name', 'fdpa_license_number', 'status'],
    '[
        {
            "name": "Sample Client Corp",
            "code": "CLIENT001",
            "contact_name": "John Doe",
            "contact_email": "john@sampleclient.com",
            "contact_phone": "555-123-4567",
            "address": "123 Main St",
            "city": "Anytown",
            "state": "CA",
            "zipcode": "90210",
            "client_type": "creditor",
            "industry": "Financial Services",
            "website": "https://sampleclient.com",
            "tax_id": "12-3456789",
            "dba_name": "Sample Client",
            "fdpa_license_number": "FDPA123456",
            "status": "active"
        }
    ]'::jsonb,
    '[
        {
            "column": "name",
            "type": "required",
            "message": "Client name is required"
        },
        {
            "column": "code",
            "type": "required",
            "message": "Client code is required"
        },
        {
            "column": "contact_email",
            "type": "email",
            "message": "Contact email must be a valid email address"
        },
        {
            "column": "client_type",
            "type": "enum",
            "message": "Client type must be one of: creditor, debt_buyer, servicer",
            "options": ["creditor", "debt_buyer", "servicer"]
        }
    ]'::jsonb
) ON CONFLICT DO NOTHING;

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
    'Import agencies with instance configuration',
    ARRAY['name', 'code', 'instance_id', 'contact_email'],
    ARRAY['instance_url', 'instance_anon_key', 'instance_service_key', 'contact_name', 'contact_phone', 'address', 'city', 'state', 'zipcode', 'subscription_tier', 'subscription_status', 'subscription_start_date', 'subscription_end_date', 'billing_cycle', 'base_monthly_fee', 'max_users', 'max_portfolios', 'max_debtors', 'storage_limit_gb', 'status'],
    '[
        {
            "name": "Sample Agency",
            "code": "AGENCY001",
            "instance_id": "sample-agency-instance",
            "contact_email": "admin@sampleagency.com",
            "instance_url": "https://sample-agency-instance.supabase.co",
            "instance_anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "instance_service_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "contact_name": "Jane Smith",
            "contact_phone": "555-987-6543",
            "address": "456 Agency Ave",
            "city": "Business City",
            "state": "TX",
            "zipcode": "75001",
            "subscription_tier": "professional",
            "subscription_status": "active",
            "subscription_start_date": "2024-01-01",
            "subscription_end_date": "2024-12-31",
            "billing_cycle": "monthly",
            "base_monthly_fee": "199.00",
            "max_users": "25",
            "max_portfolios": "250",
            "max_debtors": "25000",
            "storage_limit_gb": "25",
            "status": "active"
        }
    ]'::jsonb,
    '[
        {
            "column": "name",
            "type": "required",
            "message": "Agency name is required"
        },
        {
            "column": "code",
            "type": "required",
            "message": "Agency code is required"
        },
        {
            "column": "instance_id",
            "type": "required",
            "message": "Instance ID is required"
        },
        {
            "column": "contact_email",
            "type": "email",
            "message": "Contact email must be a valid email address"
        },
        {
            "column": "subscription_tier",
            "type": "enum",
            "message": "Subscription tier must be one of: basic, professional, enterprise",
            "options": ["basic", "professional", "enterprise"]
        }
    ]'::jsonb
) ON CONFLICT DO NOTHING; 