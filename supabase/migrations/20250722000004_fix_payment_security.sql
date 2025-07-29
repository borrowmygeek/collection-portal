-- Fix Payment Security Migration
-- This migration removes direct credit card storage and implements proper tokenization

-- ============================================================================
-- STEP 1: DROP AND RECREATE PAYMENTS TABLE WITH SECURE FIELDS
-- ============================================================================

-- Drop the existing payments table
DROP TABLE IF EXISTS payments CASCADE;

-- Create secure payments table
CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_id uuid REFERENCES debtors(id) NOT NULL,
    payment_date date NOT NULL,
    payment_amount numeric(10,2) NOT NULL,
    
    -- Payment method (no sensitive data)
    payment_method text CHECK (payment_method IN ('check', 'money_order', 'bank_transfer', 'credit_card', 'debit_card', 'cash', 'ach', 'wire_transfer', 'other')),
    
    -- Tokenized payment details (no sensitive data)
    payment_token text, -- External payment processor token
    last_four_digits text, -- Only last 4 digits for display
    card_type text CHECK (card_type IN ('visa', 'mastercard', 'amex', 'discover', 'other')), -- Card brand only
    expiration_month integer CHECK (expiration_month >= 1 AND expiration_month <= 12),
    expiration_year integer CHECK (expiration_year >= 2000 AND expiration_year <= 2100),
    
    -- Bank account info (tokenized)
    bank_account_type text CHECK (bank_account_type IN ('checking', 'savings', 'business')),
    bank_routing_last_four text, -- Only last 4 digits of routing number
    bank_account_last_four text, -- Only last 4 digits of account number
    
    -- Payment processing
    payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'cleared', 'returned', 'cancelled', 'failed', 'refunded')),
    processor_reference text, -- External processor reference ID
    processor_response text, -- Processor response message
    processing_fee numeric(6,2), -- Any processing fees
    
    -- Payment metadata
    payment_reference text, -- Internal reference number
    payment_notes text,
    payment_source text CHECK (payment_source IN ('phone', 'web', 'mail', 'in_person', 'auto_draft', 'other')),
    
    -- Compliance and audit
    pci_compliant boolean DEFAULT true, -- Ensure no sensitive data stored
    data_retention_date date, -- When to purge tokenized data
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 2: CREATE PAYMENT TOKENS TABLE FOR EXTERNAL PROCESSING
-- ============================================================================

-- Create payment tokens table for external payment processor integration
CREATE TABLE payment_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id text UNIQUE NOT NULL, -- External processor token ID
    token_type text CHECK (token_type IN ('card', 'bank_account', 'ach')),
    
    -- Token metadata (no sensitive data)
    last_four_digits text,
    card_type text CHECK (card_type IN ('visa', 'mastercard', 'amex', 'discover', 'other')),
    expiration_month integer CHECK (expiration_month >= 1 AND expiration_month <= 12),
    expiration_year integer CHECK (expiration_year >= 2000 AND expiration_year <= 2100),
    bank_account_type text CHECK (bank_account_type IN ('checking', 'savings', 'business')),
    
    -- Token status
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    
    -- Security
    encrypted_data text, -- Encrypted sensitive data (if needed for compliance)
    encryption_key_id text, -- Reference to encryption key
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    expires_at timestamptz -- Token expiration
);

-- ============================================================================
-- STEP 3: CREATE PAYMENT PROCESSING LOGS
-- ============================================================================

-- Create payment processing logs for audit trail
CREATE TABLE payment_processing_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES payments(id) NOT NULL,
    processor_name text NOT NULL, -- Stripe, Square, etc.
    processor_request_id text,
    processor_response_id text,
    
    -- Request/Response data (no sensitive data)
    request_type text CHECK (request_type IN ('authorize', 'capture', 'refund', 'void', 'tokenize')),
    request_amount numeric(10,2),
    response_code text,
    response_message text,
    response_status text CHECK (response_status IN ('success', 'failed', 'pending', 'declined')),
    
    -- Security
    ip_address inet,
    user_agent text,
    request_headers jsonb, -- Sanitized headers
    
    -- Audit
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 4: CREATE PAYMENT SETTINGS TABLE
-- ============================================================================

-- Create payment settings for agencies
CREATE TABLE payment_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id uuid REFERENCES master_agencies(id) NOT NULL,
    
    -- Payment processor configuration
    processor_name text CHECK (processor_name IN ('stripe', 'square', 'paypal', 'authorize_net', 'other')),
    processor_environment text DEFAULT 'sandbox' CHECK (processor_environment IN ('sandbox', 'production')),
    processor_public_key text, -- Public key only
    processor_webhook_secret text, -- For webhook verification
    
    -- Payment methods allowed
    allow_credit_cards boolean DEFAULT true,
    allow_debit_cards boolean DEFAULT true,
    allow_ach boolean DEFAULT true,
    allow_checks boolean DEFAULT true,
    allow_money_orders boolean DEFAULT true,
    allow_cash boolean DEFAULT true,
    
    -- Payment limits
    min_payment_amount numeric(10,2) DEFAULT 1.00,
    max_payment_amount numeric(10,2) DEFAULT 10000.00,
    daily_payment_limit numeric(12,2) DEFAULT 50000.00,
    
    -- Security settings
    require_cvv boolean DEFAULT true,
    require_billing_address boolean DEFAULT false,
    require_3d_secure boolean DEFAULT false,
    
    -- Compliance
    pci_compliance_level text DEFAULT 'saq_a' CHECK (pci_compliance_level IN ('saq_a', 'saq_a_ep', 'saq_b', 'saq_c', 'saq_d')),
    data_retention_days integer DEFAULT 2555, -- 7 years
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(agency_id)
);

-- ============================================================================
-- STEP 5: CREATE INDEXES
-- ============================================================================

-- Payments indexes
CREATE INDEX idx_payments_debtor_id ON payments(debtor_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_payment_status ON payments(payment_status);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_processor_reference ON payments(processor_reference);
CREATE INDEX idx_payments_pci_compliant ON payments(pci_compliant);

-- Payment tokens indexes
CREATE INDEX idx_payment_tokens_token_id ON payment_tokens(token_id);
CREATE INDEX idx_payment_tokens_is_active ON payment_tokens(is_active);
CREATE INDEX idx_payment_tokens_expires_at ON payment_tokens(expires_at);

-- Payment processing logs indexes
CREATE INDEX idx_payment_processing_logs_payment_id ON payment_processing_logs(payment_id);
CREATE INDEX idx_payment_processing_logs_processor_name ON payment_processing_logs(processor_name);
CREATE INDEX idx_payment_processing_logs_response_status ON payment_processing_logs(response_status);
CREATE INDEX idx_payment_processing_logs_created_at ON payment_processing_logs(created_at);

-- Payment settings indexes
CREATE INDEX idx_payment_settings_agency_id ON payment_settings(agency_id);
CREATE INDEX idx_payment_settings_processor_name ON payment_settings(processor_name);

-- ============================================================================
-- STEP 6: CREATE TRIGGERS
-- ============================================================================

-- Update timestamps for new tables
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_tokens_updated_at BEFORE UPDATE ON payment_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_settings_updated_at BEFORE UPDATE ON payment_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Platform admin can access everything
CREATE POLICY "Platform admin full access" ON payments FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON payment_tokens FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON payment_processing_logs FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');
CREATE POLICY "Platform admin full access" ON payment_settings FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Agency users can view their debtors' payments
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

-- Agency users can view their payment settings
CREATE POLICY "Agency users can view payment settings" ON payment_settings FOR SELECT USING (
    public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
    AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
);

-- ============================================================================
-- STEP 8: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to mask sensitive payment data
CREATE OR REPLACE FUNCTION mask_payment_data(payment_data jsonb)
RETURNS jsonb AS $$
BEGIN
    -- Remove any sensitive fields that might be present
    RETURN payment_data - 'card_number' - 'cvv' - 'routing_number' - 'account_number' - 'ssn';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate payment amount
CREATE OR REPLACE FUNCTION validate_payment_amount(p_agency_id uuid, p_amount numeric)
RETURNS boolean AS $$
DECLARE
    v_min_amount numeric;
    v_max_amount numeric;
    v_daily_limit numeric;
    v_daily_total numeric;
BEGIN
    -- Get payment limits for agency
    SELECT min_payment_amount, max_payment_amount, daily_payment_limit
    INTO v_min_amount, v_max_amount, v_daily_limit
    FROM payment_settings
    WHERE agency_id = p_agency_id;
    
    -- Check amount limits
    IF p_amount < v_min_amount OR p_amount > v_max_amount THEN
        RETURN false;
    END IF;
    
    -- Check daily limit
    SELECT COALESCE(SUM(payment_amount), 0)
    INTO v_daily_total
    FROM payments p
    JOIN debtors d ON p.debtor_id = d.id
    JOIN master_portfolio_placements mpp ON d.portfolio_id = mpp.portfolio_id
    WHERE mpp.agency_id = p_agency_id
    AND p.payment_date = CURRENT_DATE
    AND p.payment_status IN ('pending', 'processing', 'cleared');
    
    IF (v_daily_total + p_amount) > v_daily_limit THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create secure payment record
CREATE OR REPLACE FUNCTION create_secure_payment(
    p_debtor_id uuid,
    p_amount numeric,
    p_method text,
    p_token_id text DEFAULT NULL,
    p_last_four text DEFAULT NULL,
    p_card_type text DEFAULT NULL,
    p_reference text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_payment_id uuid;
    v_agency_id uuid;
BEGIN
    -- Get agency ID for validation
    SELECT mpp.agency_id INTO v_agency_id
    FROM debtors d
    JOIN master_portfolio_placements mpp ON d.portfolio_id = mpp.portfolio_id
    WHERE d.id = p_debtor_id;
    
    -- Validate payment amount
    IF NOT validate_payment_amount(v_agency_id, p_amount) THEN
        RAISE EXCEPTION 'Payment amount validation failed';
    END IF;
    
    -- Create payment record (no sensitive data)
    INSERT INTO payments (
        debtor_id,
        payment_date,
        payment_amount,
        payment_method,
        payment_token,
        last_four_digits,
        card_type,
        payment_reference,
        pci_compliant
    ) VALUES (
        p_debtor_id,
        CURRENT_DATE,
        p_amount,
        p_method,
        p_token_id,
        p_last_four,
        p_card_type,
        p_reference,
        true
    ) RETURNING id INTO v_payment_id;
    
    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: CREATE COMPLIANCE VIEWS
-- ============================================================================

-- Create view for PCI compliance reporting
CREATE VIEW pci_compliance_report AS
SELECT 
    p.id as payment_id,
    p.payment_date,
    p.payment_amount,
    p.payment_method,
    p.last_four_digits,
    p.card_type,
    p.pci_compliant,
    p.processor_reference,
    d.account_number,
    d.original_creditor,
    mpp.agency_id,
    ma.name as agency_name
FROM payments p
JOIN debtors d ON p.debtor_id = d.id
JOIN master_portfolio_placements mpp ON d.portfolio_id = mpp.portfolio_id
JOIN master_agencies ma ON mpp.agency_id = ma.id
WHERE p.pci_compliant = true;

-- Create view for payment audit trail
CREATE VIEW payment_audit_trail AS
SELECT 
    p.id as payment_id,
    p.payment_date,
    p.payment_amount,
    p.payment_method,
    p.payment_status,
    p.processor_reference,
    ppl.processor_name,
    ppl.request_type,
    ppl.response_status,
    ppl.response_message,
    ppl.created_at as processing_time,
    d.account_number,
    mpp.agency_id,
    ma.name as agency_name
FROM payments p
LEFT JOIN payment_processing_logs ppl ON p.id = ppl.payment_id
JOIN debtors d ON p.debtor_id = d.id
JOIN master_portfolio_placements mpp ON d.portfolio_id = mpp.portfolio_id
JOIN master_agencies ma ON mpp.agency_id = ma.id; 