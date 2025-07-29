-- Fix RLS Policies Migration
-- This migration fixes all RLS policies to use the correct JWT claims function

-- ============================================================================
-- DROP EXISTING POLICIES
-- ============================================================================

-- Drop existing policies that use the wrong JWT approach
DROP POLICY IF EXISTS "Platform admin full access" ON master_agencies;
DROP POLICY IF EXISTS "Platform admin full access" ON master_clients;
DROP POLICY IF EXISTS "Platform admin full access" ON master_portfolios;
DROP POLICY IF EXISTS "Platform admin full access" ON master_portfolio_placements;
DROP POLICY IF EXISTS "Platform admin full access" ON agency_usage;
DROP POLICY IF EXISTS "Platform admin full access" ON agency_billing;
DROP POLICY IF EXISTS "Platform admin full access" ON platform_analytics;
DROP POLICY IF EXISTS "Platform admin full access" ON audit_logs;
DROP POLICY IF EXISTS "Platform admin full access" ON platform_admins;

DROP POLICY IF EXISTS "Agency users can view own agency" ON master_agencies;
DROP POLICY IF EXISTS "Agency users can view own usage" ON agency_usage;
DROP POLICY IF EXISTS "Agency users can view own billing" ON agency_billing;

-- ============================================================================
-- CREATE NEW POLICIES USING CORRECT JWT CLAIMS
-- ============================================================================

-- Platform admin can access everything (using correct JWT claims)
CREATE POLICY "Platform admin full access" ON master_agencies 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_clients 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_portfolios 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON master_portfolio_placements 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON agency_usage 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON agency_billing 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON platform_analytics 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON audit_logs 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admin full access" ON platform_admins 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Agency users can only see their own data
CREATE POLICY "Agency users can view own agency" ON master_agencies 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

CREATE POLICY "Agency users can view own usage" ON agency_usage 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

CREATE POLICY "Agency users can view own billing" ON agency_billing 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

-- Agency users can view assigned portfolios
CREATE POLICY "Agency users can view assigned portfolios" ON master_portfolios 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

-- Agency users can view assigned clients
CREATE POLICY "Agency users can view assigned clients" ON master_clients 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND EXISTS (
            SELECT 1 FROM master_portfolios 
            WHERE client_id = master_clients.id 
            AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
        )
    );

-- Agency users can view own placements
CREATE POLICY "Agency users can view own placements" ON master_portfolio_placements 
    FOR SELECT USING (
        public.get_user_claims() ->> 'role' IN ('agency_admin', 'agency_user')
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

-- ============================================================================
-- FIX SALES MODULE RLS POLICIES
-- ============================================================================

-- Drop existing sales policies
DROP POLICY IF EXISTS "Platform admins can view all buyers" ON master_buyers;
DROP POLICY IF EXISTS "Platform admins can manage all sales" ON portfolio_sales;
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON import_templates;
DROP POLICY IF EXISTS "Platform admins can view all import jobs" ON import_jobs;

-- Create new sales policies with correct JWT claims
CREATE POLICY "Platform admins can view all buyers" ON master_buyers 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admins can manage all sales" ON portfolio_sales 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admins can manage all templates" ON import_templates 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

CREATE POLICY "Platform admins can view all import jobs" ON import_jobs 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin'); 