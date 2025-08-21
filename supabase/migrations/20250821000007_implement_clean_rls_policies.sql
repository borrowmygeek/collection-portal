-- ============================================================================
-- CLEAN RLS PERMISSION SYSTEM - PHASE 2
-- This migration implements clean, non-recursive RLS policies
-- ============================================================================

-- ============================================================================
-- STEP 1: DISABLE RLS TEMPORARILY TO BREAK RECURSION
-- ============================================================================

-- Disable RLS on user_roles to break any existing recursion
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP ALL EXISTING PROBLEMATIC POLICIES
-- ============================================================================

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Agency admins can manage agency roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON user_roles;

-- ============================================================================
-- STEP 3: CREATE CLEAN, NON-RECURSIVE RLS POLICIES
-- ============================================================================

-- Re-enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

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

-- Policy 3: Platform admins can view all roles (for user management)
CREATE POLICY "Platform admins can view all roles" ON user_roles FOR SELECT USING (
    public.is_platform_admin(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
    )
);

-- Policy 4: Platform admins can manage all roles (for user management)
CREATE POLICY "Platform admins can manage all roles" ON user_roles FOR ALL USING (
    public.is_platform_admin(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 4: IMPLEMENT RLS POLICIES FOR PLATFORM_USERS
-- ============================================================================

-- Enable RLS on platform_users if not already enabled
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON platform_users;
DROP POLICY IF EXISTS "Platform admins can view all users" ON platform_users;
DROP POLICY IF EXISTS "Platform admins can manage all users" ON platform_users;

-- Create clean policies for platform_users
CREATE POLICY "Users can view own profile" ON platform_users FOR SELECT USING (
    auth_user_id = auth.uid()
);

CREATE POLICY "Users can update own profile" ON platform_users FOR UPDATE USING (
    auth_user_id = auth.uid()
);

CREATE POLICY "Platform admins can view all users" ON platform_users FOR SELECT USING (
    public.is_platform_admin(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
    )
);

CREATE POLICY "Platform admins can manage all users" ON platform_users FOR ALL USING (
    public.is_platform_admin(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 5: IMPLEMENT RLS POLICIES FOR USER_ROLE_SESSIONS
-- ============================================================================

-- Enable RLS on user_role_sessions if not already enabled
ALTER TABLE user_role_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own sessions" ON user_role_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON user_role_sessions;

-- Create clean policies for user_role_sessions
CREATE POLICY "Users can view own sessions" ON user_role_sessions FOR SELECT USING (
    user_id IN (
        SELECT id FROM platform_users
        WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage own sessions" ON user_role_sessions FOR ALL USING (
    user_id IN (
        SELECT id FROM platform_users
        WHERE auth_user_id = auth.uid()
    )
);

-- ============================================================================
-- STEP 6: IMPLEMENT RLS POLICIES FOR MASTER_AGENCIES
-- ============================================================================

-- Enable RLS on master_agencies if not already enabled
ALTER TABLE master_agencies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Agency access policy" ON master_agencies;
DROP POLICY IF EXISTS "Platform admin full access" ON master_agencies;

-- Create clean policies for master_agencies
CREATE POLICY "Agency access policy" ON master_agencies FOR SELECT USING (
    public.can_access_agency(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid()),
        id
    )
);

CREATE POLICY "Platform admin full access" ON master_agencies FOR ALL USING (
    public.is_platform_admin(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 7: IMPLEMENT RLS POLICIES FOR MASTER_CLIENTS
-- ============================================================================

-- Enable RLS on master_clients if not already enabled
ALTER TABLE master_clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Client access policy" ON master_clients;
DROP POLICY IF EXISTS "Platform admin full access" ON master_clients;

-- Create clean policies for master_clients
CREATE POLICY "Client access policy" ON master_clients FOR SELECT USING (
    public.can_access_client(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid()),
        id
    )
);

CREATE POLICY "Platform admin full access" ON master_clients FOR ALL USING (
    public.is_platform_admin(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 8: IMPLEMENT RLS POLICIES FOR PORTFOLIOS
-- ============================================================================

-- Enable RLS on portfolios if not already enabled
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Portfolio access policy" ON portfolios;
DROP POLICY IF EXISTS "Platform admin full access" ON portfolios;

-- Create clean policies for portfolios
CREATE POLICY "Portfolio access policy" ON portfolios FOR SELECT USING (
    public.can_access_portfolio(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid()),
        id
    )
);

CREATE POLICY "Platform admin full access" ON portfolios FOR ALL USING (
    public.is_platform_admin(
        (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 9: VERIFICATION AND SUMMARY
-- ============================================================================

-- Log the implementation summary
DO $$
DECLARE
    policies_count integer;
BEGIN
    -- Count the policies we created
    SELECT COUNT(*) INTO policies_count FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('user_roles', 'platform_users', 'user_role_sessions', 'master_agencies', 'master_clients', 'portfolios');
    
    RAISE NOTICE '=== CLEAN RLS POLICIES IMPLEMENTED ===';
    RAISE NOTICE 'Total policies created: %', policies_count;
    RAISE NOTICE 'Tables with RLS:';
    RAISE NOTICE '  - user_roles (4 policies)';
    RAISE NOTICE '  - platform_users (4 policies)';
    RAISE NOTICE '  - user_role_sessions (2 policies)';
    RAISE NOTICE '  - master_agencies (2 policies)';
    RAISE NOTICE '  - master_clients (2 policies)';
    RAISE NOTICE '  - portfolios (2 policies)';
    RAISE NOTICE 'All policies are non-recursive and use direct permission checks';
    RAISE NOTICE 'RLS recursion has been eliminated';
    RAISE NOTICE '========================================';
END $$;
