-- Add SSN field to debtors table
-- SSN should be on debtors as well as persons since it's an original field for the debt

-- Add SSN column to debtors table
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS ssn text;

-- Create index on SSN for performance
CREATE INDEX IF NOT EXISTS idx_debtors_ssn ON debtors(ssn);

-- Add comment explaining the field
COMMENT ON COLUMN debtors.ssn IS 'Social Security Number - original field for the debt, also stored in persons table for person-centric data model'; 