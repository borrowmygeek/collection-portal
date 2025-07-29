# 🔐 Collection Portal - Authentication Setup Guide

## Overview

The Collection Portal now has a complete authentication system built with Supabase Auth. This guide will help you set up the authentication and create your first platform admin user.

## 🚀 Quick Setup

### 1. Environment Variables

First, ensure you have the required environment variables set up. Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://nczrnzqbthaqnrcupneu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jenJuenFidGhhcW5yY3VwbmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MjE5NzcsImV4cCI6MjA2ODA5Nzk3N30.-OS4fVX55SfZy38BmntrCjP0Qcc2SYrRriqsy92NPks

# Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. Get Your Service Role Key

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/nczrnzqbthaqnrcupneu/settings/api
2. Copy the `service_role` key (not the anon key)
3. Add it to your `.env.local` file

### 3. Apply Database Migration

Run the migration to add the platform_admins table:

```bash
# Set the service role key as an environment variable
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Apply the migration
node scripts/apply-migration.js supabase/migrations/20250714210000_add_platform_admins.sql
```

### 4. Create Platform Admin User

Use the setup script to create your first admin user:

```bash
# Set the service role key
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Create admin user (replace with your details)
node scripts/setup-admin.js admin@yourcompany.com YourSecurePassword123 "Your Name"
```

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Sign In

1. Navigate to http://localhost:3000
2. You'll be redirected to the login page
3. Use the credentials you created in step 4
4. You'll be taken to the dashboard

## 🔧 Authentication Features

### What's Included

- ✅ **User Authentication** - Email/password login
- ✅ **Session Management** - Automatic session handling
- ✅ **Protected Routes** - Client-side route protection
- ✅ **Role-Based Access** - Platform admin role system
- ✅ **Password Reset** - Forgot password functionality
- ✅ **Logout** - Secure session termination
- ✅ **User Profile** - Display user information in sidebar

### Authentication Flow

1. **Login Page** (`/auth/login`) - Email/password authentication
2. **Protected Routes** - All dashboard pages require authentication
3. **Session Persistence** - Sessions are maintained across browser sessions
4. **Automatic Redirects** - Unauthenticated users are redirected to login

### User Roles

- **Platform Admin** - Full access to all features
- **Agency User** - Limited to agency-specific data (future)
- **Client User** - Limited to client-specific data (future)

## 🛡️ Security Features

### Row Level Security (RLS)

All database tables have RLS enabled with appropriate policies:

- Platform admins can access all data
- Agency users can only access their own data
- Client users can only access their own data

### Password Requirements

- Minimum 6 characters (configurable in Supabase)
- Passwords are hashed using Supabase's secure hashing

### Session Management

- JWT tokens with configurable expiry
- Automatic token refresh
- Secure cookie handling

## 🔄 Database Schema

### Platform Admins Table

```sql
CREATE TABLE platform_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text NOT NULL,
    role text DEFAULT 'platform_admin',
    permissions jsonb DEFAULT '{
        "manage_agencies": true,
        "manage_clients": true,
        "manage_portfolios": true,
        "view_analytics": true,
        "manage_billing": true,
        "manage_users": true,
        "system_settings": true,
        "provision_instances": true,
        "view_audit_logs": true
    }',
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

## 🚨 Troubleshooting

### Common Issues

1. **"Service Role Key Required" Error**
   - Make sure you've set the `SUPABASE_SERVICE_ROLE_KEY` environment variable
   - Verify the key is correct in your Supabase dashboard

2. **"User Not Found" Error**
   - Ensure the user was created successfully using the setup script
   - Check the Supabase Auth dashboard for the user

3. **"Access Denied" Error**
   - Verify the user has the correct role (`platform_admin`)
   - Check that the platform_admins table was created successfully

4. **Login Redirect Loop**
   - Clear browser cookies and local storage
   - Check that the middleware is working correctly

### Debug Steps

1. Check browser console for errors
2. Verify environment variables are loaded
3. Check Supabase dashboard for user status
4. Verify database tables exist and have correct permissions

## 🔮 Next Steps

### Planned Enhancements

- [ ] **Multi-Factor Authentication (MFA)**
- [ ] **SSO Integration** (Google, Microsoft)
- [ ] **Advanced Role Management**
- [ ] **User Invitations**
- [ ] **Audit Logging**
- [ ] **Session Analytics**

### Agency User Setup

Once the platform admin is working, we can:

1. Create agency-specific user roles
2. Set up agency instance provisioning
3. Implement cross-instance authentication
4. Add agency user management

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the Supabase documentation
3. Check the browser console for detailed error messages
4. Verify all environment variables are set correctly

---

**🎉 Congratulations!** Your Collection Portal now has a secure, enterprise-grade authentication system ready for production use. 