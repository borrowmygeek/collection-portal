-- Fix the primary role constraint to allow multiple non-primary roles
-- The current constraint prevents having multiple roles with is_primary = false
-- We need to change it to only prevent multiple roles with is_primary = true

-- Drop the existing constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS unique_primary_role;

-- Add a new constraint that only applies when is_primary = true
-- Use a partial unique index instead of a constraint
CREATE UNIQUE INDEX unique_primary_role ON user_roles (user_id) WHERE is_primary = true;

-- Add a comment explaining the constraint
COMMENT ON INDEX unique_primary_role IS 
    'Ensures only one primary role per user (is_primary = true)'; 