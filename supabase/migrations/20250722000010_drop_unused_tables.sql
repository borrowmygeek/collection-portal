-- Drop unused tables that are no longer needed in our person-centric model
-- These tables were part of the original multi-agency platform design but are not used in the current implementation

-- Drop master_portfolio_placements table (portfolio placement tracking)
-- This was for tracking which portfolios are placed with which agencies
-- In our current model, debtors directly link to portfolios and clients
DROP TABLE IF EXISTS master_portfolio_placements CASCADE;

-- Drop agency_usage table (daily usage tracking)
-- This was for tracking daily resource usage and business metrics for each agency
-- We're not implementing usage tracking in the current system
DROP TABLE IF EXISTS agency_usage CASCADE;

-- Drop agency_billing table (billing and invoicing)
-- This was for handling billing and invoicing for agencies
-- We're not implementing billing functionality in the current system
DROP TABLE IF EXISTS agency_billing CASCADE;

-- Drop platform_analytics table (platform-wide analytics)
-- This was for storing platform-wide analytics and metrics
-- We're not implementing analytics tracking in the current system
DROP TABLE IF EXISTS platform_analytics CASCADE;

-- Drop audit_logs table (audit logging)
-- This was for tracking all system actions for compliance and debugging
-- We're not implementing audit logging in the current system
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Clean up any orphaned functions that were specific to these tables
-- Note: These functions may not exist if they were never created, but dropping them is safe
DROP FUNCTION IF EXISTS calculate_agency_billing(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS sync_agency_data(text, jsonb) CASCADE;

-- Clean up any orphaned triggers (they should be dropped with the tables, but just in case)
-- These are automatically dropped when the tables are dropped, but listed for completeness
-- No explicit DROP TRIGGER statements needed as CASCADE handles this 