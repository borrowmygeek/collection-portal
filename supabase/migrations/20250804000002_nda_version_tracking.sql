-- NDA Version Tracking System
-- This migration implements comprehensive NDA version tracking

-- =============================================
-- NDA TEMPLATES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS nda_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    version VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENHANCE MASTER_BUYERS TABLE
-- =============================================
-- Add NDA version tracking to existing buyer table
ALTER TABLE master_buyers 
ADD COLUMN IF NOT EXISTS current_nda_version VARCHAR(20),
ADD COLUMN IF NOT EXISTS nda_version_signed VARCHAR(20),
ADD COLUMN IF NOT EXISTS nda_compliance_status VARCHAR(50) DEFAULT 'pending' 
    CHECK (nda_compliance_status IN ('pending', 'compliant', 'non_compliant', 'expired'));

-- =============================================
-- ENHANCE NDA_AGREEMENTS TABLE
-- =============================================
-- Add template reference to existing NDA agreements
ALTER TABLE nda_agreements 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES nda_templates(id),
ADD COLUMN IF NOT EXISTS template_version VARCHAR(20);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_nda_templates_version ON nda_templates(version);
CREATE INDEX IF NOT EXISTS idx_nda_templates_active ON nda_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_nda_templates_effective_date ON nda_templates(effective_date);

CREATE INDEX IF NOT EXISTS idx_master_buyers_nda_version ON master_buyers(current_nda_version);
CREATE INDEX IF NOT EXISTS idx_master_buyers_nda_compliance ON master_buyers(nda_compliance_status);

CREATE INDEX IF NOT EXISTS idx_nda_agreements_template ON nda_agreements(template_id);
CREATE INDEX IF NOT EXISTS idx_nda_agreements_template_version ON nda_agreements(template_version);

-- =============================================
-- FUNCTIONS FOR NDA VALIDATION
-- =============================================

-- Function to get the current active NDA template
CREATE OR REPLACE FUNCTION get_current_nda_template()
RETURNS TABLE (
    id UUID,
    version VARCHAR(20),
    title VARCHAR(255),
    content TEXT,
    effective_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nt.id,
        nt.version,
        nt.title,
        nt.content,
        nt.effective_date
    FROM nda_templates nt
    WHERE nt.is_active = TRUE
    AND (nt.expiry_date IS NULL OR nt.expiry_date > NOW())
    ORDER BY nt.effective_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a buyer has signed the current NDA
CREATE OR REPLACE FUNCTION check_buyer_nda_compliance(buyer_uuid UUID)
RETURNS TABLE (
    is_compliant BOOLEAN,
    current_version VARCHAR(20),
    signed_version VARCHAR(20),
    compliance_status VARCHAR(50),
    message TEXT
) AS $$
DECLARE
    current_template RECORD;
    buyer_record RECORD;
BEGIN
    -- Get current NDA template
    SELECT * INTO current_template FROM get_current_nda_template();
    
    -- Get buyer record
    SELECT 
        current_nda_version,
        nda_version_signed,
        nda_compliance_status,
        nda_signed
    INTO buyer_record
    FROM master_buyers
    WHERE id = buyer_uuid;
    
    -- Check if buyer exists
    IF buyer_record IS NULL THEN
        RETURN QUERY SELECT 
            FALSE,
            current_template.version,
            NULL,
            'non_compliant',
            'Buyer not found';
        RETURN;
    END IF;
    
    -- Check if current template exists
    IF current_template IS NULL THEN
        RETURN QUERY SELECT 
            FALSE,
            NULL,
            buyer_record.nda_version_signed,
            'non_compliant',
            'No active NDA template found';
        RETURN;
    END IF;
    
    -- Check compliance
    IF buyer_record.nda_signed = FALSE THEN
        RETURN QUERY SELECT 
            FALSE,
            current_template.version,
            buyer_record.nda_version_signed,
            'non_compliant',
            'No NDA signed';
    ELSIF buyer_record.nda_version_signed IS NULL OR buyer_record.nda_version_signed != current_template.version THEN
        RETURN QUERY SELECT 
            FALSE,
            current_template.version,
            buyer_record.nda_version_signed,
            'non_compliant',
            'Outdated NDA version';
    ELSE
        RETURN QUERY SELECT 
            TRUE,
            current_template.version,
            buyer_record.nda_version_signed,
            'compliant',
            'NDA compliance verified';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update buyer NDA compliance status
CREATE OR REPLACE FUNCTION update_buyer_nda_compliance()
RETURNS TRIGGER AS $$
DECLARE
    compliance_result RECORD;
BEGIN
    -- Check compliance for the updated buyer
    SELECT * INTO compliance_result 
    FROM check_buyer_nda_compliance(NEW.id);
    
    -- Update compliance status
    UPDATE master_buyers 
    SET 
        current_nda_version = compliance_result.current_version,
        nda_compliance_status = compliance_result.compliance_status
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to update buyer compliance when NDA is signed
CREATE TRIGGER update_buyer_nda_compliance_trigger
    AFTER UPDATE OF nda_signed, nda_version_signed ON master_buyers
    FOR EACH ROW
    EXECUTE FUNCTION update_buyer_nda_compliance();

-- Trigger to update all buyers when NDA template changes
CREATE OR REPLACE FUNCTION update_all_buyers_nda_compliance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all buyers' compliance status
    UPDATE master_buyers 
    SET 
        current_nda_version = (SELECT version FROM get_current_nda_template()),
        nda_compliance_status = CASE 
            WHEN nda_signed = FALSE THEN 'non_compliant'
            WHEN nda_version_signed IS NULL THEN 'non_compliant'
            WHEN nda_version_signed != (SELECT version FROM get_current_nda_template()) THEN 'non_compliant'
            ELSE 'compliant'
        END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_all_buyers_nda_compliance_trigger
    AFTER INSERT OR UPDATE ON nda_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_all_buyers_nda_compliance();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new table
ALTER TABLE nda_templates ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage NDA templates
CREATE POLICY "Platform admins can manage NDA templates" ON nda_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM platform_users pu
            JOIN user_roles ur ON pu.id = ur.user_id
            WHERE ur.role_type = 'platform_admin'
            AND pu.auth_user_id = auth.uid()
        )
    );

-- All authenticated users can view active templates
CREATE POLICY "Users can view active NDA templates" ON nda_templates
    FOR SELECT USING (
        is_active = TRUE 
        AND (expiry_date IS NULL OR expiry_date > NOW())
    );

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default NDA template
INSERT INTO nda_templates (version, title, content, is_active, effective_date) 
VALUES (
    '1.0',
    'Standard Non-Disclosure Agreement',
    'This Non-Disclosure Agreement (the "Agreement") is entered into as of the date of signing by and between the undersigned buyer ("Receiving Party") and the debt collection platform ("Disclosing Party").

1. CONFIDENTIAL INFORMATION
The Receiving Party acknowledges that it may receive confidential information including but not limited to debtor information, portfolio data, collection strategies, and business processes.

2. NON-DISCLOSURE
The Receiving Party agrees to maintain the confidentiality of all information received and not to disclose such information to any third party without prior written consent.

3. USE RESTRICTIONS
The Receiving Party may only use the confidential information for the purpose of evaluating potential debt portfolio purchases.

4. TERM
This Agreement shall remain in effect for a period of two (2) years from the date of signing.

5. RETURN OF MATERIALS
Upon termination, the Receiving Party shall return all confidential materials to the Disclosing Party.

By signing below, the Receiving Party acknowledges that it has read, understood, and agrees to be bound by the terms of this Agreement.',
    TRUE,
    NOW()
) ON CONFLICT (version) DO NOTHING;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE nda_templates IS 'NDA template versions for buyer compliance tracking';
COMMENT ON FUNCTION get_current_nda_template() IS 'Returns the currently active NDA template';
COMMENT ON FUNCTION check_buyer_nda_compliance(UUID) IS 'Checks if a buyer has signed the current NDA version';
COMMENT ON FUNCTION update_buyer_nda_compliance() IS 'Updates buyer NDA compliance status when NDA is signed'; 