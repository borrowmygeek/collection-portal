-- Migration: Add import performance metrics table
-- Created: 2025-07-29

-- Create import performance metrics table
CREATE TABLE IF NOT EXISTS import_performance_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES import_jobs(id) ON DELETE CASCADE,
    total_rows integer NOT NULL,
    successful_rows integer NOT NULL,
    failed_rows integer NOT NULL,
    processing_time_seconds numeric(10,2) NOT NULL,
    rows_per_second numeric(10,2) NOT NULL,
    success_rate numeric(5,2) NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_performance_metrics_job_id ON import_performance_metrics(job_id);
CREATE INDEX IF NOT EXISTS idx_import_performance_metrics_created_at ON import_performance_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_import_performance_metrics_success_rate ON import_performance_metrics(success_rate);

-- Add RLS policies
ALTER TABLE import_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Allow service role full access to import performance metrics" ON import_performance_metrics
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Allow authenticated users to view metrics for their jobs
CREATE POLICY "Allow authenticated users to view their import performance metrics" ON import_performance_metrics
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM import_jobs ij
            WHERE ij.id = import_performance_metrics.job_id
            AND ij.user_id = auth.uid()
        )
    );

-- Add comments
COMMENT ON TABLE import_performance_metrics IS 'Tracks performance metrics for import jobs';
COMMENT ON COLUMN import_performance_metrics.job_id IS 'Reference to the import job';
COMMENT ON COLUMN import_performance_metrics.total_rows IS 'Total number of rows processed';
COMMENT ON COLUMN import_performance_metrics.successful_rows IS 'Number of successfully processed rows';
COMMENT ON COLUMN import_performance_metrics.failed_rows IS 'Number of failed rows';
COMMENT ON COLUMN import_performance_metrics.processing_time_seconds IS 'Total processing time in seconds';
COMMENT ON COLUMN import_performance_metrics.rows_per_second IS 'Processing rate in rows per second';
COMMENT ON COLUMN import_performance_metrics.success_rate IS 'Success rate as a percentage';
COMMENT ON COLUMN import_performance_metrics.start_time IS 'When processing started';
COMMENT ON COLUMN import_performance_metrics.end_time IS 'When processing completed'; 