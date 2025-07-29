-- Add failed_rows_csv_path field to import_jobs table
-- This field stores the path to the CSV file containing failed rows for download

ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS failed_rows_csv_path text;

-- Add comment explaining the field
COMMENT ON COLUMN import_jobs.failed_rows_csv_path IS 
'Path to the CSV file containing failed rows data for this import job. File is stored in Supabase storage under import-files bucket.'; 