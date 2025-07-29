-- Create audit_logs table for security event logging
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);

-- Add RLS policies for audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all audit logs
CREATE POLICY "Platform admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_users 
      WHERE auth_user_id = auth.uid() 
      AND role = 'platform_admin'
    )
  );

-- Agency admins can view audit logs for their agency users
CREATE POLICY "Agency admins can view their agency audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_users pu1
      JOIN platform_users pu2 ON pu1.agency_id = pu2.agency_id
      WHERE pu1.auth_user_id = auth.uid()
      AND pu1.role = 'agency_admin'
      AND pu2.id = audit_logs.user_id
    )
  );

-- Client admins can view audit logs for their client users
CREATE POLICY "Client admins can view their client audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_users pu1
      JOIN platform_users pu2 ON pu1.client_id = pu2.client_id
      WHERE pu1.auth_user_id = auth.uid()
      AND pu1.role = 'client_admin'
      AND pu2.id = audit_logs.user_id
    )
  );

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT USING (
    user_id = (
      SELECT id FROM platform_users 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Only the system can insert audit logs (via service role)
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE audit_logs IS 'Security audit log for tracking user actions and security events';
COMMENT ON COLUMN audit_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (e.g., login_success, data_create)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (e.g., user, portfolio, debtor)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN audit_logs.details IS 'Additional details about the action in JSON format';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN audit_logs.session_id IS 'Session ID for tracking user sessions';
COMMENT ON COLUMN audit_logs.success IS 'Whether the action was successful';
COMMENT ON COLUMN audit_logs.error_message IS 'Error message if the action failed'; 