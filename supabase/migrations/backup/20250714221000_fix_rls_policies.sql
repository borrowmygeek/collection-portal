-- Fix RLS policies for master_agencies table
-- Drop existing policies and recreate them properly

-- Drop existing policies
DROP POLICY IF EXISTS "Platform admin full access" ON master_agencies;

-- Create new policy that allows platform admins to do everything
CREATE POLICY "Platform admin full access" ON master_agencies 
FOR ALL USING (
  auth.jwt() ->> 'role' = 'platform_admin' OR 
  auth.jwt() ->> 'app_metadata' ->> 'role' = 'platform_admin'
);

-- Also allow users with platform_admin role in user_metadata
CREATE POLICY "Platform admin metadata access" ON master_agencies 
FOR ALL USING (
  auth.jwt() ->> 'user_metadata' ->> 'role' = 'platform_admin'
); 