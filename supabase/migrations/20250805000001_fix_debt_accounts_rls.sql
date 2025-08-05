-- Fix RLS Policies for debt_accounts table to use new user_roles system
-- This migration updates the security model to properly use the user_roles table

-- ============================================================================
-- FIX RLS POLICIES FOR DEBT_ACCOUNTS TABLE
-- ============================================================================

-- Enable RLS on debt_accounts if not already enabled
ALTER TABLE debt_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that use old role system
DROP POLICY IF EXISTS "Allow debt accounts creation for imports" ON debt_accounts;
DROP POLICY IF EXISTS "Allow full access for service role" ON debt_accounts;
DROP POLICY IF EXISTS "Users can view their own debt accounts" ON debt_accounts;
DROP POLICY IF EXISTS "Users can update their own debt accounts" ON debt_accounts;
DROP POLICY IF EXISTS "Users can view debt accounts they created" ON debt_accounts;
DROP POLICY IF EXISTS "Users can create debt accounts" ON debt_accounts;
DROP POLICY IF EXISTS "Users can update debt accounts they created" ON debt_accounts;
DROP POLICY IF EXISTS "Platform admins can view all debt accounts" ON debt_accounts;
DROP POLICY IF EXISTS "Agency users can view debt accounts in their portfolios" ON debt_accounts;
DROP POLICY IF EXISTS "Agency users can update debt accounts in their portfolios" ON debt_accounts;

-- Create new policies using the user_roles system

-- Allow service role full access (for API operations)
CREATE POLICY "Allow full access for service role" ON debt_accounts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to create debt accounts (for imports)
CREATE POLICY "Allow debt accounts creation for imports" ON debt_accounts
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Platform admins can view all debt accounts
CREATE POLICY "Platform admins can view all debt accounts" ON debt_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type = 'platform_admin'
      AND ur.is_active = true
    )
  );

-- Platform admins can update all debt accounts
CREATE POLICY "Platform admins can update all debt accounts" ON debt_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type = 'platform_admin'
      AND ur.is_active = true
    )
  );

-- Agency users can view debt accounts in their portfolios
CREATE POLICY "Agency users can view debt accounts in their portfolios" ON debt_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type IN ('agency_admin', 'agency_user')
      AND ur.organization_type = 'agency'
      AND ur.organization_id = (
        SELECT mp.client_id 
        FROM master_portfolios mp 
        WHERE mp.id = debt_accounts.portfolio_id
      )
      AND ur.is_active = true
    )
  );

-- Agency users can update debt accounts in their portfolios
CREATE POLICY "Agency users can update debt accounts in their portfolios" ON debt_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type IN ('agency_admin', 'agency_user')
      AND ur.organization_type = 'agency'
      AND ur.organization_id = (
        SELECT mp.client_id 
        FROM master_portfolios mp 
        WHERE mp.id = debt_accounts.portfolio_id
      )
      AND ur.is_active = true
    )
  );

-- Client users can view debt accounts in their portfolios
CREATE POLICY "Client users can view debt accounts in their portfolios" ON debt_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type IN ('client_admin', 'client_user')
      AND ur.organization_type = 'client'
      AND ur.organization_id = debt_accounts.client_id
      AND ur.is_active = true
    )
  );

-- Client users can update debt accounts in their portfolios
CREATE POLICY "Client users can update debt accounts in their portfolios" ON debt_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type IN ('client_admin', 'client_user')
      AND ur.organization_type = 'client'
      AND ur.organization_id = debt_accounts.client_id
      AND ur.is_active = true
    )
  );

-- Users can view debt accounts they created
CREATE POLICY "Users can view debt accounts they created" ON debt_accounts
  FOR SELECT USING (
    created_by = auth.uid()
  );

-- Users can update debt accounts they created
CREATE POLICY "Users can update debt accounts they created" ON debt_accounts
  FOR UPDATE USING (
    created_by = auth.uid()
  );

-- ============================================================================
-- FIX RLS POLICIES FOR PERSONS TABLE
-- ============================================================================

-- Enable RLS on persons if not already enabled
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that use old role system
DROP POLICY IF EXISTS "Platform admins can view all persons" ON persons;
DROP POLICY IF EXISTS "Agency users can view persons in their portfolios" ON persons;
DROP POLICY IF EXISTS "Client users can view persons in their portfolios" ON persons;

-- Platform admins can view all persons
CREATE POLICY "Platform admins can view all persons" ON persons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type = 'platform_admin'
      AND ur.is_active = true
    )
  );

-- Agency users can view persons in their portfolios
CREATE POLICY "Agency users can view persons in their portfolios" ON persons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type IN ('agency_admin', 'agency_user')
      AND ur.organization_type = 'agency'
      AND ur.is_active = true
      AND EXISTS (
        SELECT 1 FROM debt_accounts da
        JOIN master_portfolios mp ON da.portfolio_id = mp.id
        WHERE da.person_id = persons.id
        AND mp.client_id = ur.organization_id
      )
    )
  );

-- Client users can view persons in their portfolios
CREATE POLICY "Client users can view persons in their portfolios" ON persons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type IN ('client_admin', 'client_user')
      AND ur.organization_type = 'client'
      AND ur.is_active = true
      AND EXISTS (
        SELECT 1 FROM debt_accounts da
        WHERE da.person_id = persons.id
        AND da.client_id = ur.organization_id
      )
    )
  ); 