-- Add 'validating' status to import_jobs status check constraint
-- This allows jobs to show validation progress

-- Drop the existing constraint
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_status_check;

-- Re-add the constraint with 'validating' status
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_status_check 
  CHECK (status IN ('pending', 'uploaded', 'validating', 'validated', 'processing', 'completed', 'failed', 'cancelled'));

-- Also update the validation status check constraint if it exists
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_validation_status_check;

-- Re-add the validation status constraint
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_validation_status_check 
  CHECK (validation_status IN ('pending', 'validating', 'validated', 'failed') OR validation_status IS NULL);
