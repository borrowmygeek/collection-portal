const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixGetUserRoles() {
  try {
    console.log('🔧 Fixing get_user_roles function...')
    
    const fixQuery = `
      CREATE OR REPLACE FUNCTION get_user_roles(p_user_id uuid DEFAULT auth.uid())
      RETURNS jsonb AS $$
      DECLARE
          v_roles jsonb;
      BEGIN
          SELECT jsonb_agg(jsonb_build_object(
              'id', ur.id,
              'role_type', ur.role_type,
              'organization_type', ur.organization_type,
              'organization_id', ur.organization_id,
              'is_active', ur.is_active,
              'is_primary', ur.is_primary,
              'permissions', ur.permissions,
              'organization_name', 
              CASE ur.organization_type
                  WHEN 'agency' THEN 
                      COALESCE(
                          (SELECT name FROM master_agencies WHERE id = ur.organization_id),
                          'Agency ' || ur.organization_id
                      )
                  WHEN 'client' THEN 
                      COALESCE(
                          (SELECT name FROM master_clients WHERE id = ur.organization_id),
                          'Client ' || ur.organization_id
                      )
                  WHEN 'buyer' THEN 
                      COALESCE(
                          (SELECT company_name FROM master_buyers WHERE id = ur.organization_id),
                          'Buyer ' || ur.organization_id
                      )
                  ELSE 'Platform'
              END
          )) INTO v_roles
          FROM user_roles ur
          WHERE ur.user_id = p_user_id
          AND ur.is_active = true;
          
          RETURN COALESCE(v_roles, '[]'::jsonb);
      EXCEPTION
          WHEN undefined_table THEN
              -- If master tables don't exist, return roles with generic organization names
              SELECT jsonb_agg(jsonb_build_object(
                  'id', ur.id,
                  'role_type', ur.role_type,
                  'organization_type', ur.organization_type,
                  'organization_id', ur.organization_id,
                  'is_active', ur.is_active,
                  'is_primary', ur.is_primary,
                  'permissions', ur.permissions,
                  'organization_name', 
                  CASE ur.organization_type
                      WHEN 'agency' THEN 'Agency ' || ur.organization_id
                      WHEN 'client' THEN 'Client ' || ur.organization_id
                      WHEN 'buyer' THEN 'Buyer ' || ur.organization_id
                      ELSE 'Platform'
                  END
              )) INTO v_roles
              FROM user_roles ur
              WHERE ur.user_id = p_user_id
              AND ur.is_active = true;
              
              RETURN COALESCE(v_roles, '[]'::jsonb);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `

    const { error } = await supabase.rpc('exec_sql', { sql: fixQuery })
    
    if (error) {
      console.error('❌ Error fixing get_user_roles function:', error)
      return false
    }

    console.log('✅ get_user_roles function fixed successfully')
    
    // Test the function
    console.log('🧪 Testing get_user_roles function...')
    const { data: testResult, error: testError } = await supabase.rpc('get_user_roles')
    
    if (testError) {
      console.error('❌ Test failed:', testError)
      return false
    }
    
    console.log('✅ Test successful:', testResult)
    return true
    
  } catch (error) {
    console.error('❌ Exception:', error)
    return false
  }
}

fixGetUserRoles()
  .then(success => {
    if (success) {
      console.log('🎉 get_user_roles function fix completed successfully')
    } else {
      console.log('💥 get_user_roles function fix failed')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  }) 