-- Comprehensive RLS Fix - Complete Reset
-- This migration completely removes all RLS policies and recreates them without recursion

-- ============================================================================
-- STEP 1: COMPLETELY DISABLE RLS ON USER_ROLES
-- ============================================================================

-- Disable RLS temporarily to break the recursion cycle
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP ALL EXISTING POLICIES (SAFE TO DO WHEN RLS IS DISABLED)
-- ============================================================================

-- Drop all policies that might exist
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Agency admins can manage agency roles" ON user_roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON user_roles;

-- ============================================================================
-- STEP 3: RE-ENABLE RLS WITH SIMPLE POLICIES
-- ============================================================================

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE MINIMAL, NON-RECURSIVE POLICIES
-- ============================================================================

-- Policy 1: Users can view their own roles (simple, direct)
CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (
    user_id IN (
        SELECT id FROM platform_users 
        WHERE auth_user_id = auth.uid()
    )
);

-- Policy 2: Users can manage their own roles (for role switching)
CREATE POLICY "Users can manage own roles" ON user_roles FOR ALL USING (
    user_id IN (
        SELECT id FROM platform_users 
        WHERE auth_user_id = auth.uid()
    )
);

-- ============================================================================
-- STEP 5: ADD COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view own roles" ON user_roles IS 'Simple policy: users can view their own roles without recursion';
COMMENT ON POLICY "Users can manage own roles" ON user_roles IS 'Simple policy: users can manage their own roles without recursion';

-- ============================================================================
-- STEP 6: VERIFICATION
-- ============================================================================

-- Log the current state
DO $$
BEGIN
    RAISE NOTICE 'RLS policies created successfully for user_roles table';
    RAISE NOTICE 'Current policies: %', (
        SELECT string_agg(policyname, ', ') 
        FROM pg_policies 
        WHERE tablename = 'user_roles'
    );
END $$;
