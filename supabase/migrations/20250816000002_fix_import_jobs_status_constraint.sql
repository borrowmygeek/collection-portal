-- Fix import_jobs status constraint to allow all status values used by the application
-- Drop the existing constraint
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_status_check;

-- Add the new constraint with all allowed status values
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'uploaded'::text,
  'validated'::text,
  'processing'::text,
  'completed'::text,
  'failed'::text,
  'cancelled'::text
]));

-- Also fix the validation_status constraint if it exists
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_validation_status_check;

-- Add validation_status constraint
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_validation_status_check 
CHECK (validation_status = ANY (ARRAY[
  'pending'::text,
  'validated'::text,
  'failed'::text
]));

-- Verify the constraints
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'import_jobs'::regclass 
  AND contype = 'c'
  AND conname LIKE '%status%'; 