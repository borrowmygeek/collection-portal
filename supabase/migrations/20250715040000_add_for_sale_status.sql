-- Add 'for_sale' status to master_portfolios table
-- This migration adds 'for_sale' as a valid status option for portfolios

-- Update the status check constraint to include 'for_sale'
ALTER TABLE master_portfolios 
DROP CONSTRAINT IF EXISTS master_portfolios_status_check;

ALTER TABLE master_portfolios 
ADD CONSTRAINT master_portfolios_status_check 
CHECK (status IN ('active', 'inactive', 'completed', 'returned', 'for_sale')); 