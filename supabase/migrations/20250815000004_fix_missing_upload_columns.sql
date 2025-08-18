-- Fix missing columns in import_jobs table
-- This migration adds the columns that the import process is trying to update

-- Add uploaded_at column if it doesn't exist
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

-- Add validation_results column if it doesn't exist
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS validation_results JSONB;

-- Add validation_completed_at column if it doesn't exist
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS validation_completed_at TIMESTAMPTZ;

-- Add started_at column if it doesn't exist
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Add processing_completed_at column if it doesn't exist
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;

-- Add processing_errors column if it doesn't exist
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS processing_errors TEXT[];

-- Add rows_processed column if it doesn't exist (for backward compatibility)
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS rows_processed INTEGER;

-- Add RLS policies for the new columns
CREATE POLICY IF NOT EXISTS "Users can view upload fields for their own jobs" ON public.import_jobs
    FOR SELECT USING (
        auth.uid()::uuid = user_id OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::text
            AND ur.role IN ('admin', 'agency_admin')
        )
    );

CREATE POLICY IF NOT EXISTS "Users can update upload fields for their own jobs" ON public.import_jobs
    FOR UPDATE USING (
        auth.uid()::uuid = user_id OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::text
            AND ur.role IN ('admin', 'agency_admin')
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_uploaded_at ON public.import_jobs(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_validation_completed_at ON public.import_jobs(validation_completed_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_validation_results ON public.import_jobs USING GIN(validation_results);
CREATE INDEX IF NOT EXISTS idx_import_jobs_started_at ON public.import_jobs(started_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_processing_completed_at ON public.import_jobs(processing_completed_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_processing_errors ON public.import_jobs USING GIN(processing_errors);
CREATE INDEX IF NOT EXISTS idx_import_jobs_rows_processed ON public.import_jobs(rows_processed); 