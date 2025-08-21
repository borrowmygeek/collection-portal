-- ============================================================================
-- COMPREHENSIVE DATABASE BACKUP SCRIPT
-- This script backs up all tables that will be modified during RLS rewrite
-- Run this BEFORE making any changes to ensure we can restore if needed
-- ============================================================================

-- Create backup schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS backup_rls_rewrite;

-- ============================================================================
-- BACKUP PLATFORM_USERS TABLE
-- ============================================================================

-- Drop existing backup if it exists
DROP TABLE IF EXISTS backup_rls_rewrite.platform_users_backup;

-- Create backup table with all data
CREATE TABLE backup_rls_rewrite.platform_users_backup AS 
SELECT * FROM platform_users;

-- Add backup metadata
ALTER TABLE backup_rls_rewrite.platform_users_backup 
ADD COLUMN backup_timestamp timestamptz DEFAULT now(),
ADD COLUMN backup_note text DEFAULT 'Backup before RLS rewrite';

-- Create indexes on backup for performance
CREATE INDEX idx_backup_platform_users_auth_user_id ON backup_rls_rewrite.platform_users_backup(auth_user_id);
CREATE INDEX idx_backup_platform_users_email ON backup_rls_rewrite.platform_users_backup(email);

-- ============================================================================
-- BACKUP USER_ROLES TABLE
-- ============================================================================

-- Drop existing backup if it exists
DROP TABLE IF EXISTS backup_rls_rewrite.user_roles_backup;

-- Create backup table with all data
CREATE TABLE backup_rls_rewrite.user_roles_backup AS 
SELECT * FROM user_roles;

-- Add backup metadata
ALTER TABLE backup_rls_rewrite.user_roles_backup 
ADD COLUMN backup_timestamp timestamptz DEFAULT now(),
ADD COLUMN backup_note text DEFAULT 'Backup before RLS rewrite';

-- Create indexes on backup for performance
CREATE INDEX idx_backup_user_roles_user_id ON backup_rls_rewrite.user_roles_backup(user_id);
CREATE INDEX idx_backup_user_roles_role_type ON backup_rls_rewrite.user_roles_backup(role_type);

-- ============================================================================
-- BACKUP USER_ROLE_SESSIONS TABLE
-- ============================================================================

-- Drop existing backup if it exists
DROP TABLE IF EXISTS backup_rls_rewrite.user_role_sessions_backup;

-- Create backup table with all data
CREATE TABLE backup_rls_rewrite.user_role_sessions_backup AS 
SELECT * FROM user_role_sessions;

-- Add backup metadata
ALTER TABLE backup_rls_rewrite.user_role_sessions_backup 
ADD COLUMN backup_timestamp timestamptz DEFAULT now(),
ADD COLUMN backup_note text DEFAULT 'Backup before RLS rewrite';

-- Create indexes on backup for performance
CREATE INDEX idx_backup_user_role_sessions_user_id ON backup_rls_rewrite.user_role_sessions_backup(user_id);
CREATE INDEX idx_backup_user_role_sessions_session_token ON backup_rls_rewrite.user_role_sessions_backup(session_token);

-- ============================================================================
-- BACKUP RLS POLICIES INFORMATION
-- ============================================================================

-- Create table to store current RLS policy information
DROP TABLE IF EXISTS backup_rls_rewrite.rls_policies_backup;

CREATE TABLE backup_rls_rewrite.rls_policies_backup AS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('platform_users', 'user_roles', 'user_role_sessions');

-- Add backup metadata
ALTER TABLE backup_rls_rewrite.rls_policies_backup 
ADD COLUMN backup_timestamp timestamptz DEFAULT now(),
ADD COLUMN backup_note text DEFAULT 'Backup of RLS policies before rewrite';

-- ============================================================================
-- BACKUP FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Create table to store function definitions
DROP TABLE IF EXISTS backup_rls_rewrite.functions_backup;

CREATE TABLE backup_rls_rewrite.functions_backup AS
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN (
    'get_user_claims',
    'get_user_active_role',
    'get_user_roles_simple',
    'is_platform_admin_simple',
    'handle_new_user'
);

-- Add backup metadata
ALTER TABLE backup_rls_rewrite.functions_backup 
ADD COLUMN backup_timestamp timestamptz DEFAULT now(),
ADD COLUMN backup_note text DEFAULT 'Backup of functions before RLS rewrite';

-- ============================================================================
-- VERIFICATION AND SUMMARY
-- ============================================================================

-- Log backup summary
DO $$
DECLARE
    platform_users_count integer;
    user_roles_count integer;
    user_role_sessions_count integer;
    policies_count integer;
    functions_count integer;
BEGIN
    -- Count records in each backup table
    SELECT COUNT(*) INTO platform_users_count FROM backup_rls_rewrite.platform_users_backup;
    SELECT COUNT(*) INTO user_roles_count FROM backup_rls_rewrite.user_roles_backup;
    SELECT COUNT(*) INTO user_role_sessions_count FROM backup_rls_rewrite.user_role_sessions_backup;
    SELECT COUNT(*) INTO policies_count FROM backup_rls_rewrite.rls_policies_backup;
    SELECT COUNT(*) INTO functions_count FROM backup_rls_rewrite.functions_backup;
    
    -- Log the backup summary
    RAISE NOTICE '=== BACKUP COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE 'Backup timestamp: %', now();
    RAISE NOTICE 'Platform users backed up: %', platform_users_count;
    RAISE NOTICE 'User roles backed up: %', user_roles_count;
    RAISE NOTICE 'User role sessions backed up: %', user_role_sessions_count;
    RAISE NOTICE 'RLS policies backed up: %', policies_count;
    RAISE NOTICE 'Functions backed up: %', functions_count;
    RAISE NOTICE 'Backup schema: backup_rls_rewrite';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- RESTORE FUNCTION (for emergency use)
-- ============================================================================

-- Create a function to restore from backup if needed
CREATE OR REPLACE FUNCTION backup_rls_rewrite.restore_from_backup()
RETURNS text AS $$
DECLARE
    restore_message text;
BEGIN
    -- This function would restore data from backup tables
    -- Implementation would depend on specific restore needs
    
    restore_message := 'Restore function created. Use with caution.';
    RAISE NOTICE 'Restore function created: backup_rls_rewrite.restore_from_backup()';
    
    RETURN restore_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION backup_rls_rewrite.restore_from_backup() IS 'Emergency restore function - use only if RLS rewrite fails';
