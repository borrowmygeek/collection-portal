-- Fix RLS Policies for import-related tables to use new user_roles system
-- This migration updates the security model to properly use the user_roles table

-- ============================================================================
-- FIX RLS POLICIES FOR IMPORT_TEMPLATES TABLE
-- ============================================================================

-- Enable RLS on import_templates if not already enabled
ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that use old role system
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON import_templates;
DROP POLICY IF EXISTS "Users can view all templates" ON import_templates;
DROP POLICY IF EXISTS "Users can create own templates" ON import_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON import_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON import_templates;

-- Create new policies using the user_roles system

-- Allow service role full access (for API operations)
CREATE POLICY "Allow full access for service role" ON import_templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Platform admins can manage all templates
CREATE POLICY "Platform admins can manage all templates" ON import_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type = 'platform_admin'
      AND ur.is_active = true
    )
  );

-- Users can view all templates (for template selection)
CREATE POLICY "Users can view all templates" ON import_templates
  FOR SELECT USING (true);

-- Users can create their own templates
CREATE POLICY "Users can create own templates" ON import_templates
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON import_templates
  FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON import_templates
  FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- FIX RLS POLICIES FOR IMPORT_JOBS TABLE
-- ============================================================================

-- Enable RLS on import_jobs if not already enabled
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that use old role system
DROP POLICY IF EXISTS "Users can view own import jobs" ON import_jobs;
DROP POLICY IF EXISTS "Users can create own import jobs" ON import_jobs;
DROP POLICY IF EXISTS "Users can update own import jobs" ON import_jobs;
DROP POLICY IF EXISTS "Platform admins can view all import jobs" ON import_jobs;

-- Create new policies using the user_roles system

-- Allow service role full access (for API operations)
CREATE POLICY "Allow full access for service role" ON import_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Platform admins can manage all import jobs
CREATE POLICY "Platform admins can manage all import jobs" ON import_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN platform_users pu ON ur.user_id = pu.id
      WHERE pu.auth_user_id = auth.uid()
      AND ur.role_type = 'platform_admin'
      AND ur.is_active = true
    )
  );

-- Users can view their own import jobs
CREATE POLICY "Users can view their own import jobs" ON import_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own import jobs
CREATE POLICY "Users can create their own import jobs" ON import_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own import jobs
CREATE POLICY "Users can update their own import jobs" ON import_jobs
  FOR UPDATE USING (auth.uid() = user_id); 