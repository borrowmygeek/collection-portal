-- Fix Import Templates Foreign Key Constraint
-- The created_by field should reference platform_users(id) instead of auth.users(id)

-- First, drop the existing foreign key constraint
ALTER TABLE import_templates DROP CONSTRAINT IF EXISTS import_templates_created_by_fkey;

-- Add the correct foreign key constraint to platform_users
ALTER TABLE import_templates 
ADD CONSTRAINT import_templates_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES platform_users(id) ON DELETE SET NULL;

-- Update the index to reflect the new constraint
DROP INDEX IF EXISTS idx_import_templates_created_by;
CREATE INDEX idx_import_templates_created_by ON import_templates(created_by);

-- Also fix the import_jobs table if it has the same issue
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_user_id_fkey;
ALTER TABLE import_jobs 
ADD CONSTRAINT import_jobs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE;

-- Update the index for import_jobs as well
DROP INDEX IF EXISTS idx_import_jobs_user_id;
CREATE INDEX idx_import_jobs_user_id ON import_jobs(user_id);
