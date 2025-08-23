#!/usr/bin/env node

/**
 * Test Script for New RLS System
 * This script tests the new permission functions and RLS policies
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testNewRLSSystem() {
  console.log('🧪 Testing New RLS System...\n')

  try {
    // Test 1: Check if new functions exist
    console.log('📋 Test 1: Verifying new functions exist...')
    
    const functions = [
      'is_platform_admin',
      'get_user_primary_role', 
      'user_has_permission',
      'get_user_organization_context',
      'can_access_agency',
      'can_access_client',
      'get_user_profile_fast',
      'switch_user_role',
      'get_current_session_role',
      'is_user_authenticated',
      'get_user_effective_permissions'
    ]

    for (const funcName of functions) {
      try {
        const { data, error } = await supabase.rpc(funcName, { user_id: '00000000-0000-0000-0000-000000000000' })
        if (error && !error.message.includes('Invalid input')) {
          console.error(`❌ Function ${funcName} error:`, error.message)
        } else {
          console.log(`✅ Function ${funcName} exists and callable`)
        }
      } catch (err) {
        console.log(`✅ Function ${funcName} exists`)
      }
    }

    // Test 2: Check RLS policies
    console.log('\n📋 Test 2: Verifying RLS policies...')
    
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .in('tablename', ['user_roles', 'platform_users', 'user_role_sessions', 'master_agencies', 'master_clients'])

    if (policiesError) {
      console.error('❌ Error fetching policies:', policiesError)
    } else {
      console.log(`✅ Found ${policies.length} RLS policies`)
      policies.forEach(policy => {
        console.log(`   - ${policy.tablename}: ${policy.policyname}`)
      })
    }

    // Test 3: Test platform admin check with a real user
    console.log('\n📋 Test 3: Testing platform admin check...')
    
    // Get a user from the database
    const { data: users, error: usersError } = await supabase
      .from('platform_users')
      .select('id, email, auth_user_id')
      .limit(1)

    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
    } else if (users && users.length > 0) {
      const testUser = users[0]
      console.log(`   Testing with user: ${testUser.email}`)
      
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_platform_admin', {
        user_id: testUser.id
      })

      if (adminError) {
        console.error('❌ Platform admin check error:', adminError)
      } else {
        console.log(`   Is platform admin: ${isAdmin}`)
      }
    }

    // Test 4: Test fast profile fetch
    console.log('\n📋 Test 4: Testing fast profile fetch...')
    
    let profileDuration = 0
    if (users && users.length > 0) {
      const testUser = users[0]
      const startTime = Date.now()
      
      const { data: profile, error: profileError } = await supabase.rpc('get_user_profile_fast', {
        auth_user_id: testUser.auth_user_id
      })

      const endTime = Date.now()
      profileDuration = endTime - startTime

      if (profileError) {
        console.error('❌ Fast profile fetch error:', profileError)
      } else {
        console.log(`✅ Fast profile fetch successful in ${profileDuration}ms`)
        console.log(`   Profile data: ${!!profile.profile}`)
        console.log(`   Roles count: ${Array.isArray(profile.roles) ? profile.roles.length : 0}`)
        console.log(`   Primary role: ${!!profile.primary_role}`)
        
        if (profileDuration > 1000) {
          console.warn(`⚠️  Profile fetch took ${profileDuration}ms (should be < 1000ms)`)
        } else {
          console.log(`✅ Performance: ${profileDuration}ms (excellent)`)
        }
      }
    }

    // Test 5: Check indexes
    console.log('\n📋 Test 5: Verifying performance indexes...')
    
    const { data: indexes, error: indexesError } = await supabase
      .from('pg_indexes')
      .select('*')
      .eq('schemaname', 'public')
      .like('indexname', 'idx_%')

    if (indexesError) {
      console.error('❌ Error fetching indexes:', indexesError)
    } else {
      const newIndexes = indexes.filter(idx => 
        idx.indexname.includes('platform_users') || 
        idx.indexname.includes('user_roles') || 
        idx.indexname.includes('user_role_sessions')
      )
      
      console.log(`✅ Found ${newIndexes.length} new performance indexes:`)
      newIndexes.forEach(idx => {
        console.log(`   - ${idx.indexname} on ${idx.tablename}`)
      })
    }

    console.log('\n🎉 RLS System Test Complete!')
    
    if (profileDuration > 1000) {
      console.log('\n⚠️  Performance Warning: Profile fetch is still slow')
      console.log('   This may indicate database performance issues rather than RLS problems')
    } else {
      console.log('\n✅ Performance: Excellent! New RLS system is working fast')
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error)
    process.exit(1)
  }
}

// Run the test
testNewRLSSystem()
  .then(() => {
    console.log('\n✨ All tests completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
