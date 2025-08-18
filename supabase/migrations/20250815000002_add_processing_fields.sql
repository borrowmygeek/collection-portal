-- Add processing-related fields to import_jobs table
ALTER TABLE public.import_jobs 
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rows_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_errors TEXT[];

-- Add RLS policies for the new columns
CREATE POLICY "Users can view processing fields for their own jobs" ON public.import_jobs
    FOR SELECT USING (
        auth.uid()::text = user_id OR 
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid()::text 
            AND ur.role IN ('admin', 'agency_admin')
        )
    );

CREATE POLICY "Users can update processing fields for their own jobs" ON public.import_jobs
    FOR UPDATE USING (
        auth.uid()::text = user_id OR 
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid()::text 
            AND ur.role IN ('admin', 'agency_admin')
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_processing_completed_at ON public.import_jobs(processing_completed_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_rows_processed ON public.import_jobs(rows_processed); 