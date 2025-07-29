-- Add Payday/Cash Loan portfolio type
-- This migration adds the new portfolio type to the master schema

-- Update master_portfolios table
ALTER TABLE master_portfolios 
DROP CONSTRAINT IF EXISTS master_portfolios_portfolio_type_check;

ALTER TABLE master_portfolios 
ADD CONSTRAINT master_portfolios_portfolio_type_check 
CHECK (portfolio_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'payday_cash_loan', 'other')); 