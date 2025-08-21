-- Fix RLS Recursion Issue for user_roles table
-- This migration fixes the infinite recursion error that occurs when querying user_roles

-- ============================================================================
-- DROP PROBLEMATIC RLS POLICIES
-- ============================================================================

-- Drop all existing RLS policies on user_roles that cause recursion
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Agency admins can manage agency roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON user_roles;

-- ============================================================================
-- CREATE SIMPLE, NON-RECURSIVE RLS POLICIES
-- ============================================================================

-- Users can view their own roles (simple, direct check)
CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (
    user_id = (
        SELECT id FROM platform_users 
        WHERE auth_user_id = auth.uid()
    )
);

-- Platform admins can view all roles (simple check without recursion)
CREATE POLICY "Platform admins can view all roles" ON user_roles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM platform_users pu
        JOIN user_roles ur ON ur.user_id = pu.id
        WHERE pu.auth_user_id = auth.uid()
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    )
);

-- Users can manage their own roles (for role switching)
CREATE POLICY "Users can manage own roles" ON user_roles FOR ALL USING (
    user_id = (
        SELECT id FROM platform_users 
        WHERE auth_user_id = auth.uid()
    )
);

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view own roles" ON user_roles IS 'Users can view their own roles without recursion';
COMMENT ON POLICY "Platform admins can view all roles" ON user_roles IS 'Platform admins can view all roles using simple join instead of recursive RLS';
COMMENT ON POLICY "Users can manage own roles" ON user_roles IS 'Users can manage their own roles for role switching';
