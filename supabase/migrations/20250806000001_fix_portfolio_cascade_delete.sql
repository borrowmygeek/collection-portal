-- Fix CASCADE DELETE constraint on portfolio_id in debt_accounts table
-- This prevents portfolios from being automatically deleted when debt accounts are deleted

-- First, drop the existing foreign key constraint
ALTER TABLE debt_accounts 
DROP CONSTRAINT IF EXISTS debt_accounts_portfolio_id_fkey;

-- Recreate the foreign key constraint without CASCADE DELETE
ALTER TABLE debt_accounts 
ADD CONSTRAINT debt_accounts_portfolio_id_fkey 
FOREIGN KEY (portfolio_id) REFERENCES master_portfolios(id) ON DELETE RESTRICT;

-- Also fix the client_id constraint to be consistent
ALTER TABLE debt_accounts 
DROP CONSTRAINT IF EXISTS debt_accounts_client_id_fkey;

ALTER TABLE debt_accounts 
ADD CONSTRAINT debt_accounts_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES master_clients(id) ON DELETE RESTRICT;

-- Add a comment explaining the change
COMMENT ON CONSTRAINT debt_accounts_portfolio_id_fkey ON debt_accounts IS 
'Prevents automatic deletion of portfolios when debt accounts are deleted. Portfolios should be managed independently.';

COMMENT ON CONSTRAINT debt_accounts_client_id_fkey ON debt_accounts IS 
'Prevents automatic deletion of clients when debt accounts are deleted. Clients should be managed independently.'; 