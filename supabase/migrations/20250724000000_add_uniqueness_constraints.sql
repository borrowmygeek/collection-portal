-- Add uniqueness constraints for portfolios and templates

-- ============================================================================
-- PORTFOLIO UNIQUENESS
-- ============================================================================

-- Add unique constraint for portfolio names per client
-- This ensures each client can only have one portfolio with a given name
ALTER TABLE master_portfolios 
ADD CONSTRAINT unique_portfolio_name_per_client 
UNIQUE (client_id, name);

-- Add index for better performance on uniqueness checks
CREATE INDEX IF NOT EXISTS idx_master_portfolios_client_name 
ON master_portfolios(client_id, name);

-- ============================================================================
-- TEMPLATE UNIQUENESS
-- ============================================================================

-- Add unique constraint for template names per user
-- This ensures each user can only have one template with a given name
ALTER TABLE import_templates 
ADD CONSTRAINT unique_template_name_per_user 
UNIQUE (created_by, name);

-- Add index for better performance on uniqueness checks
CREATE INDEX IF NOT EXISTS idx_import_templates_user_name 
ON import_templates(created_by, name);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT unique_portfolio_name_per_client ON master_portfolios IS 
'Ensures each client can only have one portfolio with a given name';

COMMENT ON CONSTRAINT unique_template_name_per_user ON import_templates IS 
'Ensures each user can only have one template with a given name'; 