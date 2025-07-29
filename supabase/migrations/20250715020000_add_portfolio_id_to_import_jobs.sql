-- Add portfolio_id column to import_jobs table
-- This allows tracking which portfolio was created by each import job

ALTER TABLE import_jobs 
ADD COLUMN portfolio_id uuid REFERENCES master_portfolios(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_import_jobs_portfolio_id ON import_jobs(portfolio_id);

-- Add comment for documentation
COMMENT ON COLUMN import_jobs.portfolio_id IS 'References the portfolio created by this import job (for account imports)'; 