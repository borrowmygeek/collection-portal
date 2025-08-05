const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyOldAuthFix() {
  console.log('🔍 Verifying that old auth patterns have been eliminated...\n')

  try {
    // Run the deep scan query
    const { data: oldAuthPolicies, error } = await supabase.rpc('check_old_auth_patterns_deep')
    
    if (error) {
      console.error('❌ Error running deep scan:', error)
      return
    }

    const policiesWithOldAuth = oldAuthPolicies.filter(policy => policy.has_old_auth)

    if (policiesWithOldAuth.length === 0) {
      console.log('✅ SUCCESS: No RLS policies found using old auth system!')
      console.log('🎉 All RLS policies have been successfully migrated to the new user_roles system.')
    } else {
      console.log('❌ WARNING: Found RLS policies still using old auth system:')
      console.log('=' .repeat(80))
      policiesWithOldAuth.forEach(policy => {
        console.log(`\n📋 Table: ${policy.table_name}`)
        console.log(`🔒 Policy: ${policy.policy_name}`)
        console.log(`📝 Type: ${policy.policy_type}`)
        console.log(`🔍 Pattern: ${policy.pattern_found}`)
        console.log(`📄 Definition: ${policy.policy_definition}`)
      })
      console.log('\n' + '=' .repeat(80))
    }

    // Show summary
    console.log('\n📊 SUMMARY:')
    console.log('=' .repeat(50))
    console.log(`Total policies scanned: ${oldAuthPolicies.length}`)
    console.log(`Policies with old auth: ${policiesWithOldAuth.length}`)
    console.log(`Clean policies: ${oldAuthPolicies.length - policiesWithOldAuth.length}`)

    if (policiesWithOldAuth.length === 0) {
      console.log('\n🎯 MIGRATION COMPLETE: All RLS policies are now using the new auth system!')
    } else {
      console.log('\n⚠️  ACTION NEEDED: Some policies still need to be updated.')
    }

  } catch (error) {
    console.error('❌ Error verifying old auth fix:', error)
  }
}

async function main() {
  console.log('🚀 Starting verification of old auth system elimination...\n')
  await verifyOldAuthFix()
  console.log('\n🏁 Verification complete')
}

main().catch(console.error) 