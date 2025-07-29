-- Fix foreign key constraint on import_jobs.template_id to allow template deletion

-- ============================================================================
-- FIX IMPORT_JOBS TEMPLATE_ID FOREIGN KEY
-- ============================================================================

-- Drop the existing foreign key constraint
ALTER TABLE import_jobs 
DROP CONSTRAINT IF EXISTS import_jobs_template_id_fkey;

-- Add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE import_jobs 
ADD CONSTRAINT import_jobs_template_id_fkey 
FOREIGN KEY (template_id) 
REFERENCES import_templates(id) 
ON DELETE SET NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT import_jobs_template_id_fkey ON import_jobs IS 
'Foreign key to import_templates. When a template is deleted, template_id is set to NULL instead of preventing deletion.'; 