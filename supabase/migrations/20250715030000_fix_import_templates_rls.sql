-- Fix RLS policies for import_templates to allow users to manage their own templates

-- Drop existing policies
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON import_templates;
DROP POLICY IF EXISTS "Users can view all templates" ON import_templates;

-- Create new policies that allow proper access

-- Platform admins can manage all templates
CREATE POLICY "Platform admins can manage all templates" ON import_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    );

-- Users can view all templates (for template selection)
CREATE POLICY "Users can view all templates" ON import_templates
    FOR SELECT USING (true);

-- Users can create their own templates
CREATE POLICY "Users can create own templates" ON import_templates
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON import_templates
    FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON import_templates
    FOR DELETE USING (auth.uid() = created_by);

-- Add comment for documentation
COMMENT ON TABLE import_templates IS 'Import field mapping templates. Users can manage their own templates, platform admins can manage all.'; 