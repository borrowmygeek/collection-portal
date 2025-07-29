# Authentication & User Roles Setup Guide

## Overview

This guide will help you set up proper authentication and user roles so you can re-enable Row Level Security (RLS) securely.

## Current Status

✅ **What's Working:**
- Basic authentication context
- Login/logout functionality
- Protected routes component
- Dashboard with user info

❌ **What Needs Setup:**
- User roles and permissions
- RLS policies
- JWT claims
- Platform admin user

## Step-by-Step Setup

### 1. Create Platform Users Table

**Go to Supabase Dashboard → SQL Editor and run:**

```sql
-- Create platform_users table
CREATE TABLE IF NOT EXISTS platform_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text,
    role text DEFAULT 'platform_admin' CHECK (role IN ('platform_admin', 'platform_user', 'agency_admin', 'agency_user')),
    agency_id uuid REFERENCES master_agencies(id),
    permissions jsonb DEFAULT '{}',
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_platform_users_auth_user_id ON platform_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email);
CREATE INDEX IF NOT EXISTS idx_platform_users_role ON platform_users(role);
CREATE INDEX IF NOT EXISTS idx_platform_users_agency_id ON platform_users(agency_id);
```

### 2. Create JWT Claims Function

**Run this SQL (note: using public schema instead of auth schema):**

```sql
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
```

### 3. Create User Sync Trigger

**Run this SQL:**

```sql
-- Create trigger to sync auth.users with platform_users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO platform_users (auth_user_id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'platform_admin')
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
```

### 4. Set Up RLS Policies

**Run this SQL:**

```sql
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

-- Update master_agencies RLS policies
ALTER TABLE master_agencies ENABLE ROW LEVEL SECURITY;

-- Platform admins can access everything
DROP POLICY IF EXISTS "Platform admin full access" ON master_agencies;
CREATE POLICY "Platform admin full access" ON master_agencies 
    FOR ALL USING (public.get_user_claims() ->> 'role' = 'platform_admin');

-- Agency users can only see their own agency
DROP POLICY IF EXISTS "Agency users can view own agency" ON master_agencies;
CREATE POLICY "Agency users can view own agency" ON master_agencies 
    FOR SELECT USING (id = (public.get_user_claims() ->> 'agency_id')::uuid);
```

### 5. Create Platform Admin User

**Go to Supabase Dashboard → Authentication → Users → Add User:**

- **Email:** `admin@collectionportal.com`
- **Password:** `Admin123!`
- **User Metadata:**
  ```json
  {
    "full_name": "Platform Administrator",
    "role": "platform_admin"
  }
  ```

### 6. Test the Setup

1. **Sign out** of your current session
2. **Sign in** with `admin@collectionportal.com` / `Admin123!`
3. **Check** that you can see agencies in the dashboard
4. **Verify** your role shows as "Platform Admin"

## User Roles Explained

### Platform Admin
- **Access:** Full platform access
- **Can:** Manage all agencies, users, and settings
- **Use Case:** Platform administrators

### Platform User
- **Access:** Read-only platform access
- **Can:** View analytics and reports
- **Use Case:** Platform support staff

### Agency Admin
- **Access:** Full access to their agency
- **Can:** Manage agency users and settings
- **Use Case:** Agency owners/managers

### Agency User
- **Access:** Limited agency access
- **Can:** View agency data and perform basic operations
- **Use Case:** Agency staff members

## Troubleshooting

### If you can't see agencies after login:
1. Check that the user has a record in `platform_users` table
2. Verify the user's role is set correctly
3. Check that RLS policies are working

### If you get permission errors:
1. Verify JWT claims function is working
2. Check that the user's role matches the RLS policy requirements
3. Ensure the user is properly authenticated

### To check user data:
```sql
-- Check platform_users table
SELECT * FROM platform_users;

-- Check JWT claims for current user
SELECT public.get_user_claims();
```

## Next Steps

Once authentication is working:

1. **Create additional users** with appropriate roles
2. **Set up agency-specific users** for testing
3. **Implement role-based UI components**
4. **Add user management interface**

## Security Notes

- **Never share** admin credentials
- **Use strong passwords** for all users
- **Regularly audit** user permissions
- **Monitor** authentication logs
- **Consider implementing** MFA for admin accounts 