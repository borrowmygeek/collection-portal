-- Add field_mappings column to import_templates table
-- This allows storing the actual field mappings as a JSON object
-- instead of just required_columns and optional_columns arrays

ALTER TABLE import_templates 
ADD COLUMN IF NOT EXISTS field_mappings jsonb DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN import_templates.field_mappings IS 'JSON object mapping field names to column names from the import file';

-- Create index for better performance when querying by field mappings
CREATE INDEX IF NOT EXISTS idx_import_templates_field_mappings ON import_templates USING GIN (field_mappings); 