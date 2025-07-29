-- Add platform_admins table for managing platform administrators
-- This table stores additional information about platform admin users

CREATE TABLE platform_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text NOT NULL,
    role text DEFAULT 'platform_admin' CHECK (role IN ('platform_admin', 'super_admin')),
    
    -- Contact Information
    phone text,
    extension text,
    
    -- Permissions
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
    
    -- Status
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at timestamptz,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_platform_admins_auth_user_id ON platform_admins(auth_user_id);
CREATE INDEX idx_platform_admins_email ON platform_admins(email);
CREATE INDEX idx_platform_admins_status ON platform_admins(status);

-- Create trigger for updated_at
CREATE TRIGGER update_platform_admins_updated_at BEFORE UPDATE ON platform_admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all platform admins
CREATE POLICY "Platform admin full access" ON platform_admins FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');

-- Users can view their own admin profile
CREATE POLICY "Users can view own admin profile" ON platform_admins FOR SELECT USING (auth_user_id = auth.uid()); 