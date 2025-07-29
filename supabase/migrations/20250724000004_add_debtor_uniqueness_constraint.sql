-- Add unique constraint to prevent duplicate accounts
-- This constraint uses original_account_number, person_id, and current_balance as the unique identifier
-- Note: SSN is stored in the persons table, so we use person_id for uniqueness

-- First, let's check if there are any existing duplicates and handle them
-- We'll keep the first occurrence and mark others as duplicates

-- Create a temporary table to identify duplicates
CREATE TEMP TABLE duplicate_debtors AS
SELECT 
    original_account_number,
    person_id,
    current_balance,
    COUNT(*) as count,
    MIN(created_at) as first_created_at
FROM debtors 
WHERE original_account_number IS NOT NULL 
  AND person_id IS NOT NULL 
  AND current_balance IS NOT NULL
GROUP BY original_account_number, person_id, current_balance
HAVING COUNT(*) > 1;

-- Log the duplicates found
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count FROM duplicate_debtors;
    RAISE NOTICE 'Found % duplicate account groups', duplicate_count;
END $$;

-- Add a notes field to mark duplicates if it doesn't exist
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS duplicate_notes text;

-- Mark duplicates (keeping the first one)
UPDATE debtors 
SET duplicate_notes = 'DUPLICATE_ACCOUNT_REMOVED_' || NOW()::text
WHERE (original_account_number, person_id, current_balance) IN (
    SELECT original_account_number, person_id, current_balance 
    FROM duplicate_debtors
)
AND created_at > (
    SELECT first_created_at 
    FROM duplicate_debtors dd 
    WHERE dd.original_account_number = debtors.original_account_number 
      AND dd.person_id = debtors.person_id 
      AND dd.current_balance = debtors.current_balance
);

-- Now add the unique constraint
-- We'll use a partial index to only apply to non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_debtors_unique_account 
ON debtors (original_account_number, person_id, current_balance) 
WHERE original_account_number IS NOT NULL 
  AND person_id IS NOT NULL 
  AND current_balance IS NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_debtors_unique_account IS 
'Prevents duplicate accounts based on original_account_number, person_id, and current_balance combination. Only applies when all three fields are not null.'; 