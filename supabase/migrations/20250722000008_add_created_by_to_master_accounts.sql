-- Add created_by field to debtors table
ALTER TABLE debtors 
ADD COLUMN created_by uuid REFERENCES platform_users(auth_user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_debtors_created_by ON debtors(created_by);

-- Update RLS policy to allow users to view debtors they created
DROP POLICY IF EXISTS "Users can view debtors they created" ON debtors;
CREATE POLICY "Users can view debtors they created" ON debtors
    FOR SELECT USING (auth.uid() = created_by);

-- Update RLS policy to allow users to create debtors
DROP POLICY IF EXISTS "Users can create debtors" ON debtors;
CREATE POLICY "Users can create debtors" ON debtors
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Platform admins can view all debtors (existing policy should handle this)
-- But let's make sure it's explicit
DROP POLICY IF EXISTS "Platform admins can view all debtors" ON debtors;
CREATE POLICY "Platform admins can view all debtors" ON debtors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    ); 