const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyDatabaseFix() {
  try {
    console.log('🔧 Applying database fix for get_user_roles function...')
    
    // First, let's test the current function to see the exact error
    console.log('🧪 Testing current get_user_roles function...')
    const { data: testResult, error: testError } = await supabase.rpc('get_user_roles')
    
    if (testError) {
      console.log('❌ Current function error:', testError.message)
    } else {
      console.log('✅ Current function works:', testResult)
      return true
    }

    // Apply the fix using a direct SQL query
    console.log('🔧 Applying fix...')
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

    // Try to execute the SQL directly
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: fixQuery })
    
    if (sqlError) {
      console.log('❌ exec_sql not available, trying alternative approach...')
      
      // Alternative: Try to create a temporary function and test it
      console.log('🔧 Trying to create a test function...')
      const testFunctionQuery = `
        CREATE OR REPLACE FUNCTION test_get_user_roles_fix(p_user_id uuid DEFAULT auth.uid())
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
      
      const { error: testFuncError } = await supabase.rpc('exec_sql', { sql: testFunctionQuery })
      
      if (testFuncError) {
        console.log('❌ Cannot execute SQL directly. Please apply the fix manually.')
        console.log('📋 Instructions:')
        console.log('1. Go to your Supabase Dashboard')
        console.log('2. Navigate to SQL Editor')
        console.log('3. Run the contents of scripts/fix-get-user-roles.sql')
        return false
      }
      
      // Test the new function
      const { data: newTestResult, error: newTestError } = await supabase.rpc('test_get_user_roles_fix')
      
      if (newTestError) {
        console.log('❌ New function also failed:', newTestError)
        return false
      }
      
      console.log('✅ Test function works:', newTestResult)
      console.log('📋 Please manually replace get_user_roles with the fixed version')
      return false
    }

    console.log('✅ Database fix applied successfully')
    
    // Test the fixed function
    console.log('🧪 Testing fixed get_user_roles function...')
    const { data: fixedResult, error: fixedError } = await supabase.rpc('get_user_roles')
    
    if (fixedError) {
      console.error('❌ Fixed function still has issues:', fixedError)
      return false
    }
    
    console.log('✅ Fixed function works:', fixedResult)
    return true
    
  } catch (error) {
    console.error('❌ Exception:', error)
    return false
  }
}

applyDatabaseFix()
  .then(success => {
    if (success) {
      console.log('🎉 Database fix completed successfully')
      console.log('🔄 The application should now work properly')
    } else {
      console.log('💥 Database fix failed - manual intervention required')
      console.log('📋 Please run the SQL in scripts/fix-get-user-roles.sql manually')
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  }) 