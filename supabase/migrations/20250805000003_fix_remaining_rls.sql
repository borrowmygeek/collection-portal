-- Fix remaining RLS policies that are still using the old role system
-- This migration updates all remaining security policies to use the new user_roles table

-- ============================================================================
-- FIX RLS POLICIES FOR IMPORT_PERFORMANCE_METRICS TABLE
-- ============================================================================

-- Enable RLS on import_performance_metrics if not already enabled
ALTER TABLE import_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that use old role system
DROP POLICY IF EXISTS "Allow service role full access to import performance metrics" ON import_performance_metrics;
DROP POLICY IF EXISTS "Allow authenticated users to view their import performance metrics" ON import_performance_metrics;

-- Create new policies using the user_roles system

-- Allow service role full access (for API operations)
CREATE POLICY "Allow full access for service role" ON import_performance_metrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Platform admins can view all import performance metrics
CREATE POLICY "Platform admins can view all import performance metrics" ON import_performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type = 'platform_admin'
      AND ur.is_active = true
    )
  );

-- Users can view metrics for their own import jobs
CREATE POLICY "Users can view their own import performance metrics" ON import_performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM import_jobs ij
      WHERE ij.id = import_performance_metrics.job_id
      AND ij.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX RLS POLICIES FOR SATELLITE PERSON TABLES
-- ============================================================================

-- Person addresses
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'person_addresses') THEN
    ALTER TABLE person_addresses ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all person addresses" ON person_addresses;
    DROP POLICY IF EXISTS "Agency users can view person addresses in their portfolios" ON person_addresses;
    DROP POLICY IF EXISTS "Client users can view person addresses in their portfolios" ON person_addresses;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all person addresses" ON person_addresses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view person addresses in their portfolios" ON person_addresses
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
            WHERE da.person_id = person_addresses.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view person addresses in their portfolios" ON person_addresses
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
            WHERE da.person_id = person_addresses.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$;

-- Phone numbers
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'phone_numbers') THEN
    ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all phone numbers" ON phone_numbers;
    DROP POLICY IF EXISTS "Agency users can view phone numbers in their portfolios" ON phone_numbers;
    DROP POLICY IF EXISTS "Client users can view phone numbers in their portfolios" ON phone_numbers;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all phone numbers" ON phone_numbers
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view phone numbers in their portfolios" ON phone_numbers
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
            WHERE da.person_id = phone_numbers.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view phone numbers in their portfolios" ON phone_numbers
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
            WHERE da.person_id = phone_numbers.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$;

-- Emails
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'emails') THEN
    ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all emails" ON emails;
    DROP POLICY IF EXISTS "Agency users can view emails in their portfolios" ON emails;
    DROP POLICY IF EXISTS "Client users can view emails in their portfolios" ON emails;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all emails" ON emails
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view emails in their portfolios" ON emails
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
            WHERE da.person_id = emails.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view emails in their portfolios" ON emails
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
            WHERE da.person_id = emails.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$;

-- Relatives
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'relatives') THEN
    ALTER TABLE relatives ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all relatives" ON relatives;
    DROP POLICY IF EXISTS "Agency users can view relatives in their portfolios" ON relatives;
    DROP POLICY IF EXISTS "Client users can view relatives in their portfolios" ON relatives;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all relatives" ON relatives
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view relatives in their portfolios" ON relatives
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
            WHERE da.person_id = relatives.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view relatives in their portfolios" ON relatives
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
            WHERE da.person_id = relatives.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$;

-- Properties
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'properties') THEN
    ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all properties" ON properties;
    DROP POLICY IF EXISTS "Agency users can view properties in their portfolios" ON properties;
    DROP POLICY IF EXISTS "Client users can view properties in their portfolios" ON properties;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all properties" ON properties
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view properties in their portfolios" ON properties
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
            WHERE da.person_id = properties.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view properties in their portfolios" ON properties
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
            WHERE da.person_id = properties.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$;

-- Vehicles
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vehicles') THEN
    ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all vehicles" ON vehicles;
    DROP POLICY IF EXISTS "Agency users can view vehicles in their portfolios" ON vehicles;
    DROP POLICY IF EXISTS "Client users can view vehicles in their portfolios" ON vehicles;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all vehicles" ON vehicles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view vehicles in their portfolios" ON vehicles
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
            WHERE da.person_id = vehicles.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view vehicles in their portfolios" ON vehicles
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
            WHERE da.person_id = vehicles.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$;

-- Places of employment
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'places_of_employment') THEN
    ALTER TABLE places_of_employment ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all places of employment" ON places_of_employment;
    DROP POLICY IF EXISTS "Agency users can view places of employment in their portfolios" ON places_of_employment;
    DROP POLICY IF EXISTS "Client users can view places of employment in their portfolios" ON places_of_employment;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all places of employment" ON places_of_employment
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view places of employment in their portfolios" ON places_of_employment
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
            WHERE da.person_id = places_of_employment.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view places of employment in their portfolios" ON places_of_employment
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
            WHERE da.person_id = places_of_employment.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$;

-- Bankruptcies
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bankruptcies') THEN
    ALTER TABLE bankruptcies ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Platform admins can view all bankruptcies" ON bankruptcies;
    DROP POLICY IF EXISTS "Agency users can view bankruptcies in their portfolios" ON bankruptcies;
    DROP POLICY IF EXISTS "Client users can view bankruptcies in their portfolios" ON bankruptcies;
    
    -- Create new policies using the user_roles system
    CREATE POLICY "Platform admins can view all bankruptcies" ON bankruptcies
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN platform_users pu ON ur.user_id = pu.id
          WHERE pu.auth_user_id = auth.uid()
          AND ur.role_type = 'platform_admin'
          AND ur.is_active = true
        )
      );
    
    CREATE POLICY "Agency users can view bankruptcies in their portfolios" ON bankruptcies
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
            WHERE da.person_id = bankruptcies.person_id
            AND mp.client_id = ur.organization_id
          )
        )
      );
    
    CREATE POLICY "Client users can view bankruptcies in their portfolios" ON bankruptcies
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
            WHERE da.person_id = bankruptcies.person_id
            AND da.client_id = ur.organization_id
          )
        )
      );
  END IF;
END $$; 