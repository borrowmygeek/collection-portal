-- Add bank information fields to debtors table for payday loans and similar financial products
-- This allows storing the original bank information used to take out the loan

-- Add bank information fields to debtors table
ALTER TABLE debtors 
ADD COLUMN IF NOT EXISTS original_bank_name text,
ADD COLUMN IF NOT EXISTS original_bank_routing_number text,
ADD COLUMN IF NOT EXISTS original_bank_account_number text,
ADD COLUMN IF NOT EXISTS original_bank_account_type text CHECK (original_bank_account_type IN ('checking', 'savings', 'business', 'other')),
ADD COLUMN IF NOT EXISTS original_bank_account_holder text,
ADD COLUMN IF NOT EXISTS original_bank_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS original_bank_verification_date date,
ADD COLUMN IF NOT EXISTS original_bank_verification_method text CHECK (original_bank_verification_method IN ('skip_trace', 'manual', 'credit_bureau', 'bank_verification', 'other'));

-- Add indexes for bank information fields
CREATE INDEX IF NOT EXISTS idx_debtors_original_bank_name ON debtors(original_bank_name);
CREATE INDEX IF NOT EXISTS idx_debtors_original_bank_routing ON debtors(original_bank_routing_number);
CREATE INDEX IF NOT EXISTS idx_debtors_original_bank_verified ON debtors(original_bank_verified);

-- Add comments for documentation
COMMENT ON COLUMN debtors.original_bank_name IS 'Name of the bank where the original loan was taken out';
COMMENT ON COLUMN debtors.original_bank_routing_number IS 'Routing number of the bank account used for the original loan';
COMMENT ON COLUMN debtors.original_bank_account_number IS 'Account number used for the original loan (stored securely)';
COMMENT ON COLUMN debtors.original_bank_account_type IS 'Type of bank account used for the original loan';
COMMENT ON COLUMN debtors.original_bank_account_holder IS 'Name of the account holder on the original bank account';
COMMENT ON COLUMN debtors.original_bank_verified IS 'Whether the bank information has been verified';
COMMENT ON COLUMN debtors.original_bank_verification_date IS 'Date when the bank information was last verified';
COMMENT ON COLUMN debtors.original_bank_verification_method IS 'Method used to verify the bank information';

-- Create a function to mask sensitive bank information for display
CREATE OR REPLACE FUNCTION mask_bank_account_number(account_number text)
RETURNS text AS $$
BEGIN
    IF account_number IS NULL OR length(account_number) < 4 THEN
        RETURN account_number;
    END IF;
    
    RETURN '****' || right(account_number, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to mask routing number for display
CREATE OR REPLACE FUNCTION mask_bank_routing_number(routing_number text)
RETURNS text AS $$
BEGIN
    IF routing_number IS NULL OR length(routing_number) < 4 THEN
        RETURN routing_number;
    END IF;
    
    RETURN left(routing_number, 3) || '****' || right(routing_number, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for displaying masked bank information
CREATE OR REPLACE VIEW debtors_bank_info AS
SELECT 
    id,
    account_number,
    original_creditor,
    original_bank_name,
    mask_bank_routing_number(original_bank_routing_number) as masked_routing_number,
    mask_bank_account_number(original_bank_account_number) as masked_account_number,
    original_bank_account_type,
    original_bank_account_holder,
    original_bank_verified,
    original_bank_verification_date,
    original_bank_verification_method
FROM debtors
WHERE original_bank_name IS NOT NULL 
   OR original_bank_routing_number IS NOT NULL 
   OR original_bank_account_number IS NOT NULL;

-- Grant appropriate permissions
GRANT SELECT ON debtors_bank_info TO authenticated;

-- Add RLS policy for the view
ALTER VIEW debtors_bank_info SET (security_invoker = true); 