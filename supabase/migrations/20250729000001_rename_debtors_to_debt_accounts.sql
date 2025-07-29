-- Rename debtors table to debt_accounts for better clarity
-- This table stores debt accounts/obligations, not the actual debtors (people)

-- 1. Rename the main table
ALTER TABLE debtors RENAME TO debt_accounts;

-- 2. Update all indexes
ALTER INDEX idx_debtors_person_id RENAME TO idx_debt_accounts_person_id;
ALTER INDEX idx_debtors_portfolio_id RENAME TO idx_debt_accounts_portfolio_id;
ALTER INDEX idx_debtors_client_id RENAME TO idx_debt_accounts_client_id;
ALTER INDEX idx_debtors_account_number RENAME TO idx_debt_accounts_account_number;
ALTER INDEX idx_debtors_original_account_number RENAME TO idx_debt_accounts_original_account_number;
ALTER INDEX idx_debtors_external_id RENAME TO idx_debt_accounts_external_id;
ALTER INDEX idx_debtors_created_by RENAME TO idx_debt_accounts_created_by;
ALTER INDEX idx_debtors_assigned_collector_id RENAME TO idx_debt_accounts_assigned_collector_id;
ALTER INDEX idx_debtors_status RENAME TO idx_debt_accounts_status;
ALTER INDEX idx_debtors_collection_status RENAME TO idx_debt_accounts_collection_status;
ALTER INDEX idx_debtors_charge_off_date RENAME TO idx_debt_accounts_charge_off_date;
ALTER INDEX idx_debtors_current_balance RENAME TO idx_debt_accounts_current_balance;
ALTER INDEX idx_debtors_import_batch_id RENAME TO idx_debt_accounts_import_batch_id;
ALTER INDEX idx_debtors_original_creditor RENAME TO idx_debt_accounts_original_creditor;
ALTER INDEX idx_debtors_account_subtype RENAME TO idx_debt_accounts_account_subtype;
ALTER INDEX idx_debtors_date_opened RENAME TO idx_debt_accounts_date_opened;
ALTER INDEX idx_debtors_last_activity RENAME TO idx_debt_accounts_last_activity;
ALTER INDEX idx_debtors_import_batch RENAME TO idx_debt_accounts_import_batch;
ALTER INDEX idx_debtors_account_type RENAME TO idx_debt_accounts_account_type;
ALTER INDEX idx_debtors_ssn RENAME TO idx_debt_accounts_ssn;
ALTER INDEX idx_debtors_data_quality_risk_level RENAME TO idx_debt_accounts_data_quality_risk_level;
ALTER INDEX idx_debtors_data_quality_score RENAME TO idx_debt_accounts_data_quality_score;
ALTER INDEX idx_debtors_original_bank_name RENAME TO idx_debt_accounts_original_bank_name;
ALTER INDEX idx_debtors_original_bank_routing RENAME TO idx_debt_accounts_original_bank_routing;
ALTER INDEX idx_debtors_original_bank_verified RENAME TO idx_debt_accounts_original_bank_verified;
ALTER INDEX idx_debtors_unique_account RENAME TO idx_debt_accounts_unique_account;

-- 3. Update foreign key constraints
ALTER TABLE debt_accounts 
  DROP CONSTRAINT IF EXISTS debtors_assigned_collector_id_fkey,
  DROP CONSTRAINT IF EXISTS debtors_client_id_fkey,
  DROP CONSTRAINT IF EXISTS debtors_created_by_fkey,
  DROP CONSTRAINT IF EXISTS debtors_person_id_fkey,
  DROP CONSTRAINT IF EXISTS debtors_portfolio_id_fkey;

ALTER TABLE debt_accounts 
  ADD CONSTRAINT debt_accounts_assigned_collector_id_fkey 
    FOREIGN KEY (assigned_collector_id) REFERENCES platform_users(id),
  ADD CONSTRAINT debt_accounts_client_id_fkey 
    FOREIGN KEY (client_id) REFERENCES master_clients(id),
  ADD CONSTRAINT debt_accounts_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES platform_users(id),
  ADD CONSTRAINT debt_accounts_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES persons(id),
  ADD CONSTRAINT debt_accounts_portfolio_id_fkey 
    FOREIGN KEY (portfolio_id) REFERENCES master_portfolios(id);

-- 4. Update RLS policies
DROP POLICY IF EXISTS "Allow debtors creation for imports" ON debt_accounts;
DROP POLICY IF EXISTS "Allow full access for service role and platform admins" ON debt_accounts;
DROP POLICY IF EXISTS "Users can view their own debtors" ON debt_accounts;
DROP POLICY IF EXISTS "Users can update their own debtors" ON debt_accounts;
DROP POLICY IF EXISTS "Agency users can view portfolio debtors" ON debt_accounts;
DROP POLICY IF EXISTS "Agency users can update portfolio debtors" ON debt_accounts;
DROP POLICY IF EXISTS "Users can view debtors they created" ON debt_accounts;
DROP POLICY IF EXISTS "Users can create debtors" ON debt_accounts;
DROP POLICY IF EXISTS "Users can update debtors they created" ON debt_accounts;
DROP POLICY IF EXISTS "Platform admins can view all debtors" ON debt_accounts;
DROP POLICY IF EXISTS "Agency users can view debtors in their portfolios" ON debt_accounts;
DROP POLICY IF EXISTS "Agency users can update debtors in their portfolios" ON debt_accounts;

-- Recreate policies with new table name
CREATE POLICY "Allow debt accounts creation for imports" ON debt_accounts
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);

CREATE POLICY "Allow full access for service role and platform admins" ON debt_accounts
  FOR ALL TO service_role, platform_admin
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their own debt accounts" ON debt_accounts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can update their own debt accounts" ON debt_accounts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Agency users can view portfolio debt accounts" ON debt_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM master_portfolios mp
      JOIN platform_users pu ON mp.agency_id = pu.agency_id
      WHERE mp.id = debt_accounts.portfolio_id
      AND pu.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Agency users can update portfolio debt accounts" ON debt_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM master_portfolios mp
      JOIN platform_users pu ON mp.agency_id = pu.agency_id
      WHERE mp.id = debt_accounts.portfolio_id
      AND pu.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view debt accounts they created" ON debt_accounts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create debt accounts" ON debt_accounts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update debt accounts they created" ON debt_accounts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Platform admins can view all debt accounts" ON debt_accounts
  FOR SELECT TO platform_admin
  USING (true);

CREATE POLICY "Agency users can view debt accounts in their portfolios" ON debt_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM master_portfolios mp
      JOIN platform_users pu ON mp.agency_id = pu.agency_id
      WHERE mp.id = debt_accounts.portfolio_id
      AND pu.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Agency users can update debt accounts in their portfolios" ON debt_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM master_portfolios mp
      JOIN platform_users pu ON mp.agency_id = pu.agency_id
      WHERE mp.id = debt_accounts.portfolio_id
      AND pu.auth_user_id = auth.uid()
    )
  );

-- 5. Update trigger
DROP TRIGGER IF EXISTS update_debtors_updated_at ON debt_accounts;
CREATE TRIGGER update_debt_accounts_updated_at 
  BEFORE UPDATE ON debt_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Update view
DROP VIEW IF EXISTS debtors_bank_info;
CREATE OR REPLACE VIEW debt_accounts_bank_info AS
SELECT 
  da.id as debt_account_id,
  da.account_number,
  da.original_account_number,
  da.original_bank_name,
  da.original_bank_routing_number,
  da.original_bank_account_number,
  da.original_bank_account_type,
  da.original_bank_account_holder,
  da.original_bank_verified,
  da.original_bank_verification_date,
  da.original_bank_verification_method,
  p.full_name as account_holder_name,
  p.ssn as account_holder_ssn,
  mp.name as portfolio_name,
  mc.name as client_name
FROM debt_accounts da
LEFT JOIN persons p ON da.person_id = p.id
LEFT JOIN master_portfolios mp ON da.portfolio_id = mp.id
LEFT JOIN master_clients mc ON da.client_id = mc.id
WHERE da.original_bank_name IS NOT NULL
  OR da.original_bank_routing_number IS NOT NULL
  OR da.original_bank_account_number IS NOT NULL;

GRANT SELECT ON debt_accounts_bank_info TO authenticated;
ALTER VIEW debt_accounts_bank_info SET (security_invoker = true);

-- 7. Update function
CREATE OR REPLACE FUNCTION insert_debt_account_bypass_rls(
  account_data jsonb
) RETURNS uuid AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO debt_accounts (
    account_number,
    original_account_number,
    external_id,
    import_batch_id,
    ssn,
    original_creditor,
    original_creditor_name,
    original_balance,
    current_balance,
    last_payment_amount,
    promise_to_pay_amount,
    settlement_offered,
    interest_rate,
    late_fees,
    collection_fees,
    legal_fees,
    total_fees,
    payment_plan_amount,
    account_type,
    account_subtype,
    account_status,
    charge_off_date,
    date_opened,
    last_activity_date,
    last_payment_date,
    promise_to_pay_date,
    next_payment_date,
    status,
    collection_status,
    collection_priority,
    contact_method,
    contact_result,
    contact_notes,
    payment_plan_frequency,
    payment_frequency,
    total_payments,
    payment_count,
    average_payment,
    largest_payment,
    do_not_call,
    hardship_declared,
    hardship_type,
    settlement_accepted,
    data_source,
    skip_trace_quality_score,
    notes,
    original_bank_name,
    original_bank_routing_number,
    original_bank_account_number,
    original_bank_account_type,
    original_bank_account_holder,
    original_bank_verified,
    original_bank_verification_date,
    original_bank_verification_method,
    portfolio_id,
    client_id,
    created_by,
    person_id,
    data_quality_score,
    data_quality_risk_level,
    data_quality_warnings,
    data_quality_flags,
    created_at,
    updated_at
  ) VALUES (
    (account_data->>'account_number')::text,
    (account_data->>'original_account_number')::text,
    (account_data->>'external_id')::text,
    (account_data->>'import_batch_id')::uuid,
    (account_data->>'ssn')::text,
    (account_data->>'original_creditor')::text,
    (account_data->>'original_creditor_name')::text,
    (account_data->>'original_balance')::numeric,
    (account_data->>'current_balance')::numeric,
    (account_data->>'last_payment_amount')::numeric,
    (account_data->>'promise_to_pay_amount')::numeric,
    (account_data->>'settlement_offered')::numeric,
    (account_data->>'interest_rate')::numeric,
    (account_data->>'late_fees')::numeric,
    (account_data->>'collection_fees')::numeric,
    (account_data->>'legal_fees')::numeric,
    (account_data->>'total_fees')::numeric,
    (account_data->>'payment_plan_amount')::numeric,
    (account_data->>'account_type')::text,
    (account_data->>'account_subtype')::text,
    (account_data->>'account_status')::text,
    (account_data->>'charge_off_date')::timestamp with time zone,
    (account_data->>'date_opened')::timestamp with time zone,
    (account_data->>'last_activity_date')::timestamp with time zone,
    (account_data->>'last_payment_date')::timestamp with time zone,
    (account_data->>'promise_to_pay_date')::timestamp with time zone,
    (account_data->>'next_payment_date')::timestamp with time zone,
    (account_data->>'status')::text,
    (account_data->>'collection_status')::text,
    (account_data->>'collection_priority')::text,
    (account_data->>'contact_method')::text,
    (account_data->>'contact_result')::text,
    (account_data->>'contact_notes')::text,
    (account_data->>'payment_plan_frequency')::text,
    (account_data->>'payment_frequency')::text,
    (account_data->>'total_payments')::numeric,
    (account_data->>'payment_count')::integer,
    (account_data->>'average_payment')::numeric,
    (account_data->>'largest_payment')::numeric,
    (account_data->>'do_not_call')::boolean,
    (account_data->>'hardship_declared')::boolean,
    (account_data->>'hardship_type')::text,
    (account_data->>'settlement_accepted')::boolean,
    (account_data->>'data_source')::text,
    (account_data->>'skip_trace_quality_score')::numeric,
    (account_data->>'notes')::text,
    (account_data->>'original_bank_name')::text,
    (account_data->>'original_bank_routing_number')::text,
    (account_data->>'original_bank_account_number')::text,
    (account_data->>'original_bank_account_type')::text,
    (account_data->>'original_bank_account_holder')::text,
    (account_data->>'original_bank_verified')::boolean,
    (account_data->>'original_bank_verification_date')::timestamp with time zone,
    (account_data->>'original_bank_verification_method')::text,
    (account_data->>'portfolio_id')::uuid,
    (account_data->>'client_id')::uuid,
    (account_data->>'created_by')::uuid,
    (account_data->>'person_id')::uuid,
    (account_data->>'data_quality_score')::integer,
    (account_data->>'data_quality_risk_level')::text,
    (account_data->>'data_quality_warnings')::text,
    (account_data->>'data_quality_flags')::text,
    (account_data->>'created_at')::timestamp with time zone,
    (account_data->>'updated_at')::timestamp with time zone
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update comments
COMMENT ON TABLE debt_accounts IS 'Stores debt accounts/obligations. Each record represents a single debt account linked to a person.';
COMMENT ON COLUMN debt_accounts.ssn IS 'Social Security Number - original field for the debt, also stored in persons table for person-centric data model';
COMMENT ON COLUMN debt_accounts.data_quality_score IS 'Overall data quality score (0-100) based on fuzzy logic assessment';
COMMENT ON COLUMN debt_accounts.data_quality_risk_level IS 'Risk level based on data quality assessment: low, medium, high, critical';
COMMENT ON COLUMN debt_accounts.data_quality_warnings IS 'Semicolon-separated list of data quality warnings';
COMMENT ON COLUMN debt_accounts.data_quality_flags IS 'Semicolon-separated list of data quality flags for suspicious patterns';
COMMENT ON COLUMN debt_accounts.original_bank_name IS 'Name of the bank where the original loan was taken out';
COMMENT ON COLUMN debt_accounts.original_bank_routing_number IS 'Routing number of the bank account used for the original loan';
COMMENT ON COLUMN debt_accounts.original_bank_account_number IS 'Account number used for the original loan (stored securely)';
COMMENT ON COLUMN debt_accounts.original_bank_account_type IS 'Type of bank account used for the original loan';
COMMENT ON COLUMN debt_accounts.original_bank_account_holder IS 'Name of the account holder on the original bank account';
COMMENT ON COLUMN debt_accounts.original_bank_verified IS 'Whether the bank information has been verified';
COMMENT ON COLUMN debt_accounts.original_bank_verification_date IS 'Date when the bank information was last verified';
COMMENT ON COLUMN debt_accounts.original_bank_verification_method IS 'Method used to verify the bank information';

COMMENT ON INDEX idx_debt_accounts_unique_account IS 'Ensures unique combination of original_account_number, person_id, and current_balance to prevent duplicate accounts';