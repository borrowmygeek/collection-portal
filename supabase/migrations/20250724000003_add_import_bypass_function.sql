-- Create a function to insert debtors bypassing RLS for imports
CREATE OR REPLACE FUNCTION insert_debtor_bypass_rls(
  p_account_number text,
  p_original_account_number text,
  p_external_id text,
  p_import_batch_id uuid,
  p_original_creditor text,
  p_original_creditor_name text,
  p_original_balance numeric,
  p_current_balance numeric,
  p_portfolio_id uuid,
  p_client_id uuid,
  p_created_by uuid,
  p_status text DEFAULT 'new',
  p_collection_status text DEFAULT 'new',
  p_collection_priority text DEFAULT 'normal',
  p_account_status text DEFAULT 'active'
) RETURNS uuid AS $$
DECLARE
  v_debtor_id uuid;
BEGIN
  -- Insert the debtor record
  INSERT INTO debtors (
    account_number,
    original_account_number,
    external_id,
    import_batch_id,
    original_creditor,
    original_creditor_name,
    original_balance,
    current_balance,
    portfolio_id,
    client_id,
    created_by,
    status,
    collection_status,
    collection_priority,
    account_status
  ) VALUES (
    p_account_number,
    p_original_account_number,
    p_external_id,
    p_import_batch_id,
    p_original_creditor,
    p_original_creditor_name,
    p_original_balance,
    p_current_balance,
    p_portfolio_id,
    p_client_id,
    p_created_by,
    p_status,
    p_collection_status,
    p_collection_priority,
    p_account_status
  ) RETURNING id INTO v_debtor_id;
  
  RETURN v_debtor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 