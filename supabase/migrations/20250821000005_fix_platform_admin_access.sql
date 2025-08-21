-- Fix Platform Admin Access for User Management
-- This migration adds back the ability for platform admins to view all user roles

-- ============================================================================
-- ADD PLATFORM ADMIN POLICY FOR USER ROLES
-- ============================================================================

-- Add policy for platform admins to view all roles (needed for user management page)
CREATE POLICY "Platform admins can view all roles" ON user_roles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM platform_users pu
        JOIN user_roles ur ON ur.user_id = pu.id
        WHERE pu.auth_user_id = auth.uid()
        AND ur.role_type = 'platform_admin'
        AND ur.is_active = true
    )
);

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON POLICY "Platform admins can view all roles" ON user_roles IS 'Platform admins can view all user roles for user management functionality';
