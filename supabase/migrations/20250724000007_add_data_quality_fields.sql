-- Add data quality assessment fields to debtors table
-- These fields store the results of fuzzy logic data quality scoring

ALTER TABLE debtors ADD COLUMN IF NOT EXISTS data_quality_score integer;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS data_quality_risk_level text CHECK (data_quality_risk_level IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS data_quality_warnings text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS data_quality_flags text;

-- Add comments explaining the fields
COMMENT ON COLUMN debtors.data_quality_score IS 'Overall data quality score (0-100) based on fuzzy logic assessment';
COMMENT ON COLUMN debtors.data_quality_risk_level IS 'Risk level based on data quality assessment: low, medium, high, critical';
COMMENT ON COLUMN debtors.data_quality_warnings IS 'Semicolon-separated list of data quality warnings';
COMMENT ON COLUMN debtors.data_quality_flags IS 'Semicolon-separated list of data quality flags for suspicious patterns';

-- Create index for efficient querying by risk level
CREATE INDEX IF NOT EXISTS idx_debtors_data_quality_risk_level ON debtors(data_quality_risk_level);
CREATE INDEX IF NOT EXISTS idx_debtors_data_quality_score ON debtors(data_quality_score); 