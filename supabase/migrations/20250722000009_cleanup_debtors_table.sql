-- Clean up debtors table by removing fields that belong on other tables
-- These fields should be on persons, phone_numbers, or emails tables

-- Remove contact fields that belong on person/contact tables
ALTER TABLE debtors DROP COLUMN IF EXISTS phone_primary;
ALTER TABLE debtors DROP COLUMN IF EXISTS phone_secondary;
ALTER TABLE debtors DROP COLUMN IF EXISTS phone_work;
ALTER TABLE debtors DROP COLUMN IF EXISTS email_primary;
ALTER TABLE debtors DROP COLUMN IF EXISTS email_secondary;

-- Remove address fields that belong on person_addresses table
ALTER TABLE debtors DROP COLUMN IF EXISTS address_line1;
ALTER TABLE debtors DROP COLUMN IF EXISTS address_line2;
ALTER TABLE debtors DROP COLUMN IF EXISTS city;
ALTER TABLE debtors DROP COLUMN IF EXISTS state;
ALTER TABLE debtors DROP COLUMN IF EXISTS zipcode;
ALTER TABLE debtors DROP COLUMN IF EXISTS county;
ALTER TABLE debtors DROP COLUMN IF EXISTS country;

-- Remove compliance flags that belong on persons table
ALTER TABLE debtors DROP COLUMN IF EXISTS do_not_mail;
ALTER TABLE debtors DROP COLUMN IF EXISTS do_not_email;
ALTER TABLE debtors DROP COLUMN IF EXISTS do_not_text;
ALTER TABLE debtors DROP COLUMN IF EXISTS bankruptcy_filed;
ALTER TABLE debtors DROP COLUMN IF EXISTS active_military;

-- Remove verification fields that belong on contact tables
ALTER TABLE debtors DROP COLUMN IF EXISTS address_verified;
ALTER TABLE debtors DROP COLUMN IF EXISTS phone_verified;
ALTER TABLE debtors DROP COLUMN IF EXISTS email_verified;
ALTER TABLE debtors DROP COLUMN IF EXISTS employment_verified;
ALTER TABLE debtors DROP COLUMN IF EXISTS income_verified;
ALTER TABLE debtors DROP COLUMN IF EXISTS last_verification_date;
ALTER TABLE debtors DROP COLUMN IF EXISTS address_confirmed;

-- Remove fields that are redundant or don't belong
ALTER TABLE debtors DROP COLUMN IF EXISTS timezone;
ALTER TABLE debtors DROP COLUMN IF EXISTS homeowner;
ALTER TABLE debtors DROP COLUMN IF EXISTS sms_consent;

-- Add missing fields that should be on debtors table
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS original_creditor_name text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS account_subtype text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS date_opened date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS last_activity_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS interest_rate decimal(5,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS late_fees decimal(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS collection_fees decimal(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS legal_fees decimal(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS total_fees decimal(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS payment_plan_amount decimal(10,2);
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS payment_plan_frequency text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS next_payment_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS last_skip_trace_date date;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS skip_trace_quality_score integer;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS data_source text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE debtors ADD COLUMN IF NOT EXISTS notes text;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_debtors_original_creditor ON debtors(original_creditor_name);
CREATE INDEX IF NOT EXISTS idx_debtors_account_subtype ON debtors(account_subtype);
CREATE INDEX IF NOT EXISTS idx_debtors_date_opened ON debtors(date_opened);
CREATE INDEX IF NOT EXISTS idx_debtors_last_activity ON debtors(last_activity_date);
CREATE INDEX IF NOT EXISTS idx_debtors_import_batch ON debtors(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_debtors_external_id ON debtors(external_id);

-- Update RLS policies to reflect the cleaned up table structure
DROP POLICY IF EXISTS "Users can view debtors they created" ON debtors;
CREATE POLICY "Users can view debtors they created" ON debtors
    FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create debtors" ON debtors;
CREATE POLICY "Users can create debtors" ON debtors
    FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Platform admins can view all debtors" ON debtors;
CREATE POLICY "Platform admins can view all debtors" ON debtors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'platform_admin'
        )
    ); 