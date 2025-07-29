-- User Management System Migration
-- This migration sets up the complete user management system with triggers, functions, and RLS policies

-- ============================================================================
-- JWT CLAIMS FUNCTION
-- ============================================================================

-- Create JWT claims function in public schema
CREATE OR REPLACE FUNCTION public.get_user_claims()
RETURNS jsonb AS $$
DECLARE
    v_user platform_users%ROWTYPE;
    v_claims jsonb;
BEGIN
    -- Get user from platform_users table
    SELECT * INTO v_user 
    FROM platform_users 
    WHERE auth_user_id = auth.uid();
    
    IF NOT FOUND THEN
        -- Return basic claims for unregistered users
        RETURN jsonb_build_object(
            'role', 'anonymous',
            'email', auth.jwt() ->> 'email'
        );
    END IF;
    
    -- Build claims for authenticated users
    v_claims := jsonb_build_object(
        'role', v_user.role,
        'email', v_user.email,
        'full_name', v_user.full_name,
        'agency_id', v_user.agency_id,
        'permissions', v_user.permissions,
        'status', v_user.status
    );
    
    RETURN v_claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- USER SYNC TRIGGER
-- ============================================================================

-- Create trigger to sync auth.users with platform_users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.platform_users (auth_user_id, email, full_name, role, agency_id, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'platform_user'),
        (NEW.raw_user_meta_data->>'agency_id')::uuid,
        'active'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on platform_users
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all users
DROP POLICY IF EXISTS "Platform admin full access" ON platform_users;
CREATE POLICY "Platform admin full access" ON platform_users 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON platform_users;
CREATE POLICY "Users can view own profile" ON platform_users 
    FOR SELECT USING (auth_user_id = auth.uid());

-- Agency admins can manage their agency users
DROP POLICY IF EXISTS "Agency admin can manage agency users" ON platform_users;
CREATE POLICY "Agency admin can manage agency users" ON platform_users 
    FOR ALL USING (
        public.get_user_claims() ->> 'role' = 'agency_admin' 
        AND agency_id = (public.get_user_claims() ->> 'agency_id')::uuid
    );

-- ============================================================================
-- UPDATE TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for platform_users updated_at
DROP TRIGGER IF EXISTS update_platform_users_updated_at ON platform_users;
CREATE TRIGGER update_platform_users_updated_at 
    BEFORE UPDATE ON platform_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 