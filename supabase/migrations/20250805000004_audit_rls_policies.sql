-- Audit RLS policies to check for old auth system usage (deep scan)
-- This migration creates a function to report any RLS policies still using the old auth system in their definitions

-- Create a function to list all RLS policies with their definitions
CREATE OR REPLACE FUNCTION list_all_rls_policies()
RETURNS TABLE (
    table_name text,
    policy_name text,
    policy_type text,
    policy_definition text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (n.nspname || '.' || c.relname)::text as table_name,
        pol.polname::text as policy_name,
        CASE 
            WHEN pol.polcmd = 'r' THEN 'SELECT'::text
            WHEN pol.polcmd = 'a' THEN 'INSERT'::text
            WHEN pol.polcmd = 'w' THEN 'UPDATE'::text
            WHEN pol.polcmd = 'd' THEN 'DELETE'::text
            WHEN pol.polcmd = '*' THEN 'ALL'::text
            ELSE 'UNKNOWN'::text
        END as policy_type,
        pg_get_expr(pol.polqual, pol.polrelid)::text as policy_definition
    FROM pg_policy pol
    JOIN pg_class c ON pol.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname NOT IN ('information_schema', 'pg_catalog')
    ORDER BY c.relname, pol.polname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check for old auth patterns in policy definitions
CREATE OR REPLACE FUNCTION check_old_auth_patterns_deep()
RETURNS TABLE (
    table_name text,
    policy_name text,
    policy_type text,
    has_old_auth boolean,
    pattern_found text,
    policy_definition text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.table_name,
        p.policy_name,
        p.policy_type,
        CASE 
            WHEN p.policy_definition ILIKE '%raw_user_meta_data%' 
                 OR p.policy_definition ILIKE '%app_metadata%'
                 OR p.policy_definition ILIKE '%user_metadata%'
                 OR p.policy_definition ILIKE '%auth.users%'
            THEN true
            ELSE false
        END as has_old_auth,
        CASE 
            WHEN p.policy_definition ILIKE '%raw_user_meta_data%' THEN 'raw_user_meta_data in definition'::text
            WHEN p.policy_definition ILIKE '%app_metadata%' THEN 'app_metadata in definition'::text
            WHEN p.policy_definition ILIKE '%user_metadata%' THEN 'user_metadata in definition'::text
            WHEN p.policy_definition ILIKE '%auth.users%' THEN 'auth.users in definition'::text
            ELSE 'No old auth pattern found'::text
        END as pattern_found,
        p.policy_definition
    FROM list_all_rls_policies() p
    ORDER BY p.table_name, p.policy_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get summary of old auth usage in definitions
CREATE OR REPLACE FUNCTION get_old_auth_summary_deep()
RETURNS TABLE (
    total_policies integer,
    old_auth_policies integer,
    needs_review boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::integer as total_policies,
        COUNT(*) FILTER (WHERE has_old_auth)::integer as old_auth_policies,
        (COUNT(*) FILTER (WHERE has_old_auth) > 0)::boolean as needs_review
    FROM check_old_auth_patterns_deep();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION list_all_rls_policies() IS 'Lists all RLS policies in the database, including their definitions.';
COMMENT ON FUNCTION check_old_auth_patterns_deep() IS 'Checks for old auth patterns in RLS policy definitions.';
COMMENT ON FUNCTION get_old_auth_summary_deep() IS 'Returns summary of old auth usage in RLS policy definitions.';

-- Log the audit results (deep scan)
DO $$
DECLARE
    summary record;
    policy record;
    total_count integer;
BEGIN
    -- Get total count of policies
    SELECT COUNT(*) INTO total_count FROM list_all_rls_policies();
    
    -- Get summary
    SELECT * INTO summary FROM get_old_auth_summary_deep();
    
    -- Log summary
    RAISE NOTICE 'RLS Policy Audit Summary (Deep Scan):';
    RAISE NOTICE 'Total policies: %', total_count;
    RAISE NOTICE 'Policies with old auth patterns in definitions: %', summary.old_auth_policies;
    RAISE NOTICE 'Needs review: %', summary.needs_review;
    
    -- Log policies that need updating
    IF summary.needs_review THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Policies with potential old auth patterns in definitions:';
        FOR policy IN SELECT * FROM check_old_auth_patterns_deep() WHERE has_old_auth = true LOOP
            RAISE NOTICE 'Table: %, Policy: %, Type: %, Pattern: %', policy.table_name, policy.policy_name, policy.policy_type, policy.pattern_found;
            RAISE NOTICE 'Definition: %', policy.policy_definition;
        END LOOP;
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✅ No old auth patterns found in RLS policy definitions!';
    END IF;
    
    -- List all policies for reference
    RAISE NOTICE '';
    RAISE NOTICE 'All RLS policies (with definitions):';
    FOR policy IN SELECT * FROM list_all_rls_policies() LOOP
        RAISE NOTICE 'Table: %, Policy: %, Type: %', policy.table_name, policy.policy_name, policy.policy_type;
        RAISE NOTICE 'Definition: %', policy.policy_definition;
    END LOOP;
END $$; 