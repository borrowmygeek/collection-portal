const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Testing Authentication System...')
console.log('📡 Supabase URL:', supabaseUrl)
console.log('🔑 Anon Key present:', !!supabaseAnonKey)
console.log('🔑 Service Key present:', !!supabaseServiceKey)

// Create clients
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testAuth() {
  try {
    console.log('\n🔍 Testing platform_users table access...')
    
    // Test with anon client
    const { data: anonUsers, error: anonError } = await anonClient
      .from('platform_users')
      .select('id, email, auth_user_id')
      .limit(1)
    
    console.log('✅ Anon client result:', {
      hasData: !!anonUsers,
      dataLength: anonUsers?.length || 0,
      hasError: !!anonError,
      error: anonError?.message
    })

    // Test with admin client
    const { data: adminUsers, error: adminError } = await adminClient
      .from('platform_users')
      .select('id, email, auth_user_id')
      .limit(1)
    
    console.log('✅ Admin client result:', {
      hasData: !!adminUsers,
      dataLength: adminUsers?.length || 0,
      hasError: !!adminError,
      error: adminError?.message
    })

    // Test RPC functions
    console.log('\n🔍 Testing RPC functions...')
    
    if (adminUsers && adminUsers.length > 0) {
      const testUserId = adminUsers[0].id
      console.log('🧪 Testing with user ID:', testUserId)
      
      const { data: activeRole, error: activeRoleError } = await adminClient
        .rpc('get_user_active_role_simple', { p_user_id: testUserId })
      
      console.log('✅ Active role result:', {
        hasData: !!activeRole,
        data: activeRole,
        hasError: !!activeRoleError,
        error: activeRoleError?.message
      })

      const { data: allRoles, error: allRolesError } = await adminClient
        .rpc('get_user_roles_simple', { p_user_id: testUserId })
      
      console.log('✅ All roles result:', {
        hasData: !!allRoles,
        dataLength: allRoles?.length || 0,
        hasError: !!allRolesError,
        error: allRolesError?.message
      })
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testAuth() 