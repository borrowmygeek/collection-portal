-- Fix CASCADE DELETE constraint on portfolio_id in portfolio_sales table
-- This prevents portfolios from being automatically deleted when portfolio sales are deleted

-- First, drop the existing foreign key constraint
ALTER TABLE portfolio_sales 
DROP CONSTRAINT IF EXISTS portfolio_sales_portfolio_id_fkey;

-- Recreate the foreign key constraint without CASCADE DELETE
ALTER TABLE portfolio_sales 
ADD CONSTRAINT portfolio_sales_portfolio_id_fkey 
FOREIGN KEY (portfolio_id) REFERENCES master_portfolios(id) ON DELETE RESTRICT;

-- Also fix the client_id constraint to be consistent
ALTER TABLE portfolio_sales 
DROP CONSTRAINT IF EXISTS portfolio_sales_client_id_fkey;

ALTER TABLE portfolio_sales 
ADD CONSTRAINT portfolio_sales_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES master_clients(id) ON DELETE RESTRICT;

-- Add a comment explaining the change
COMMENT ON CONSTRAINT portfolio_sales_portfolio_id_fkey ON portfolio_sales IS 
'Prevents automatic deletion of portfolios when portfolio sales are deleted. Portfolios should be managed independently.';

COMMENT ON CONSTRAINT portfolio_sales_client_id_fkey ON portfolio_sales IS 
'Prevents automatic deletion of clients when portfolio sales are deleted. Clients should be managed independently.'; 