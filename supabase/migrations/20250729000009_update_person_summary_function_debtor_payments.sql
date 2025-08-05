-- Migration: Update person summary function to use debtor_payments table name
-- Created: 2025-07-29

-- ============================================================================
-- UPDATE PERSON SUMMARY FUNCTION
-- ============================================================================

-- Update the function to use new table name
CREATE OR REPLACE FUNCTION get_comprehensive_person_summary(p_person_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'person', row_to_json(p.*),
        'debt_accounts', COALESCE(
            (SELECT jsonb_agg(row_to_json(d.*))
             FROM debt_accounts d
             WHERE d.person_id = p_person_id),
            '[]'::jsonb
        ),
        'addresses', COALESCE(
            (SELECT jsonb_agg(row_to_json(pa.*))
             FROM person_addresses pa
             WHERE pa.person_id = p_person_id),
            '[]'::jsonb
        ),
        'phones', COALESCE(
            (SELECT jsonb_agg(row_to_json(pn.*))
             FROM person_phones pn
             WHERE pn.person_id = p_person_id),
            '[]'::jsonb
        ),
        'emails', COALESCE(
            (SELECT jsonb_agg(row_to_json(e.*))
             FROM person_emails e
             WHERE e.person_id = p_person_id),
            '[]'::jsonb
        ),
        'relatives', COALESCE(
            (SELECT jsonb_agg(row_to_json(r.*))
             FROM person_relatives r
             WHERE r.person_id = p_person_id),
            '[]'::jsonb
        ),
        'properties', COALESCE(
            (SELECT jsonb_agg(row_to_json(prop.*))
             FROM person_properties prop
             WHERE prop.person_id = p_person_id),
            '[]'::jsonb
        ),
        'vehicles', COALESCE(
            (SELECT jsonb_agg(row_to_json(v.*))
             FROM person_vehicles v
             WHERE v.person_id = p_person_id),
            '[]'::jsonb
        ),
        'employment', COALESCE(
            (SELECT jsonb_agg(row_to_json(emp.*))
             FROM person_employments emp
             WHERE emp.person_id = p_person_id),
            '[]'::jsonb
        ),
        'bankruptcies', COALESCE(
            (SELECT jsonb_agg(row_to_json(b.*))
             FROM person_bankruptcies b
             WHERE b.person_id = p_person_id),
            '[]'::jsonb
        ),
        'calls', COALESCE(
            (SELECT jsonb_agg(row_to_json(c.*))
             FROM calls c
             JOIN debt_accounts d ON c.debtor_id = d.id
             WHERE d.person_id = p_person_id),
            '[]'::jsonb
        ),
        'notes', COALESCE(
            (SELECT jsonb_agg(row_to_json(n.*))
             FROM debtor_notes n
             JOIN debt_accounts d ON n.debtor_id = d.id
             WHERE d.person_id = p_person_id),
            '[]'::jsonb
        ),
        'payments', COALESCE(
            (SELECT jsonb_agg(row_to_json(pay.*))
             FROM debtor_payments pay
             JOIN debt_accounts d ON pay.debtor_id = d.id
             WHERE d.person_id = p_person_id),
            '[]'::jsonb
        )
    ) INTO v_result
    FROM persons p
    WHERE p.id = p_person_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 