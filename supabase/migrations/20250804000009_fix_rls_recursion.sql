-- Fix RLS Recursion Issue
-- This migration fixes the infinite recursion error in RLS policies

-- ============================================================================
-- FIX PLATFORM_USERS RLS POLICIES
-- ============================================================================

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Platform admins can view all users" ON platform_users;

-- Create a simpler policy that doesn't cause recursion
-- Users can view their own profile (this is already correct)
-- For platform admins, we'll use a different approach

-- Create a function to check if user is platform admin without recursion
CREATE OR REPLACE FUNCTION is_platform_admin_simple(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
    -- Check if user has platform_admin role directly
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = (
            SELECT id FROM platform_users 
            WHERE auth_user_id = p_user_id
        )
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policy for platform admins
CREATE POLICY "Platform admins can view all users" ON platform_users FOR ALL USING (
    auth_user_id = auth.uid() OR is_platform_admin_simple()
);

-- ============================================================================
-- FIX USER_ROLES RLS POLICIES
-- ============================================================================

-- Enable RLS on user_roles if not already enabled
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON user_roles;

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (
    user_id = (
        SELECT id FROM platform_users 
        WHERE auth_user_id = auth.uid()
    )
);

-- Platform admins can view all roles
CREATE POLICY "Platform admins can view all roles" ON user_roles FOR ALL USING (
    is_platform_admin_simple()
);

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION is_platform_admin_simple IS 'Simple function to check if user is platform admin without causing RLS recursion'; 