const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS policies for old auth system usage...\n')

  try {
    // Query to get all RLS policies
    const { data: policies, error } = await supabase.rpc('get_rls_policies')
    
    if (error) {
      console.error('❌ Error fetching RLS policies:', error)
      return
    }

    if (!policies || policies.length === 0) {
      console.log('✅ No RLS policies found')
      return
    }

    console.log(`📋 Found ${policies.length} RLS policies\n`)

    const oldAuthPatterns = [
      'auth.users.raw_user_meta_data',
      'auth.users.app_metadata',
      'auth.users.user_metadata',
      'raw_user_meta_data',
      'app_metadata',
      'user_metadata'
    ]

    let oldAuthPolicies = []
    let newAuthPolicies = []
    let otherPolicies = []

    policies.forEach(policy => {
      const policyDefinition = policy.policy_definition || ''
      const hasOldAuth = oldAuthPatterns.some(pattern => 
        policyDefinition.toLowerCase().includes(pattern.toLowerCase())
      )

      if (hasOldAuth) {
        oldAuthPolicies.push(policy)
      } else if (policyDefinition.toLowerCase().includes('user_roles') || 
                 policyDefinition.toLowerCase().includes('platform_users')) {
        newAuthPolicies.push(policy)
      } else {
        otherPolicies.push(policy)
      }
    })

    // Report old auth policies
    if (oldAuthPolicies.length > 0) {
      console.log('❌ RLS POLICIES USING OLD AUTH SYSTEM:')
      console.log('=' .repeat(60))
      oldAuthPolicies.forEach(policy => {
        console.log(`\n📋 Table: ${policy.table_name}`)
        console.log(`🔒 Policy: ${policy.policy_name}`)
        console.log(`📝 Definition: ${policy.policy_definition}`)
        console.log(`👤 Roles: ${policy.roles}`)
        console.log(`🔧 Commands: ${policy.command}`)
      })
      console.log('\n')
    } else {
      console.log('✅ No RLS policies found using old auth system\n')
    }

    // Report new auth policies
    if (newAuthPolicies.length > 0) {
      console.log('✅ RLS POLICIES USING NEW AUTH SYSTEM:')
      console.log('=' .repeat(60))
      newAuthPolicies.forEach(policy => {
        console.log(`\n📋 Table: ${policy.table_name}`)
        console.log(`🔒 Policy: ${policy.policy_name}`)
        console.log(`📝 Definition: ${policy.policy_definition}`)
        console.log(`👤 Roles: ${policy.roles}`)
        console.log(`🔧 Commands: ${policy.command}`)
      })
      console.log('\n')
    }

    // Report other policies
    if (otherPolicies.length > 0) {
      console.log('🔍 OTHER RLS POLICIES:')
      console.log('=' .repeat(60))
      otherPolicies.forEach(policy => {
        console.log(`\n📋 Table: ${policy.table_name}`)
        console.log(`🔒 Policy: ${policy.policy_name}`)
        console.log(`📝 Definition: ${policy.policy_definition}`)
        console.log(`👤 Roles: ${policy.roles}`)
        console.log(`🔧 Commands: ${policy.command}`)
      })
      console.log('\n')
    }

    // Summary
    console.log('📊 SUMMARY:')
    console.log('=' .repeat(60))
    console.log(`Total policies: ${policies.length}`)
    console.log(`Old auth policies: ${oldAuthPolicies.length}`)
    console.log(`New auth policies: ${newAuthPolicies.length}`)
    console.log(`Other policies: ${otherPolicies.length}`)

    if (oldAuthPolicies.length > 0) {
      console.log('\n❌ ACTION REQUIRED: Found policies using old auth system!')
      console.log('These need to be updated to use the new user_roles system.')
    } else {
      console.log('\n✅ All RLS policies are using the new auth system!')
    }

  } catch (error) {
    console.error('❌ Error checking RLS policies:', error)
  }
}

// Create the RPC function if it doesn't exist
async function createRLSCheckFunction() {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION get_rls_policies()
    RETURNS TABLE (
      table_name text,
      policy_name text,
      policy_definition text,
      roles text,
      command text
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        schemaname || '.' || tablename as table_name,
        policyname as policy_name,
        pg_get_expr(polcmd, polrelid) as policy_definition,
        array_to_string(polroles, ',') as roles,
        CASE 
          WHEN polcmd = 'r' THEN 'SELECT'
          WHEN polcmd = 'a' THEN 'INSERT'
          WHEN polcmd = 'w' THEN 'UPDATE'
          WHEN polcmd = 'd' THEN 'DELETE'
          WHEN polcmd = '*' THEN 'ALL'
          ELSE 'UNKNOWN'
        END as command
      FROM pg_policies 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY tablename, policyname;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `

  try {
    const { error } = await supabase.rpc('get_rls_policies')
    if (error && error.message.includes('function get_rls_policies() does not exist')) {
      console.log('🔧 Creating RLS check function...')
      const { error: createError } = await supabase.rpc('exec_sql', { sql: functionSQL })
      if (createError) {
        console.error('❌ Error creating function:', createError)
        return false
      }
      console.log('✅ RLS check function created')
      return true
    }
    return true
  } catch (error) {
    console.error('❌ Error checking/creating function:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting RLS policy audit...\n')
  
  const functionReady = await createRLSCheckFunction()
  if (functionReady) {
    await checkRLSPolicies()
  }
  
  console.log('\n🏁 RLS policy audit complete')
}

main().catch(console.error) 