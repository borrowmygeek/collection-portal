const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

async function testSimpleFunction() {
  console.log('🔍 Testing get_user_profile_simple function...')
  
  // Try to get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Test 1: Check if function exists
    console.log('\n1. Checking if function exists...')
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .eq('routine_name', 'get_user_profile_simple')

    if (funcError) {
      console.error('❌ Error checking functions:', funcError)
    } else {
      console.log('✅ Functions found:', functions?.length || 0)
      if (functions && functions.length > 0) {
        console.log('   - get_user_profile_simple EXISTS')
      } else {
        console.log('   ❌ get_user_profile_simple does NOT exist')
        return
      }
    }

    // Test 2: Check if we have any users
    console.log('\n2. Checking users...')
    const { data: users, error: usersError } = await supabase
      .from('platform_users')
      .select('id, email, auth_user_id, status')
      .limit(1)

    if (usersError) {
      console.error('❌ Error checking users:', usersError)
      return
    }

    if (!users || users.length === 0) {
      console.error('❌ No users found')
      return
    }

    const testUser = users[0]
    console.log('✅ Test user found:', testUser.email)

    // Test 3: Try calling the function
    console.log('\n3. Testing function call...')
    console.log('   Calling get_user_profile_simple with auth_user_id:', testUser.auth_user_id)
    
    const startTime = Date.now()
    const { data, error } = await supabase.rpc('get_user_profile_simple', {
      auth_user_id: testUser.auth_user_id
    })
    const endTime = Date.now()
    
    console.log('   Function call completed in:', endTime - startTime, 'ms')

    if (error) {
      console.error('❌ Function call error:', error)
      return
    }

    if (!data) {
      console.error('❌ No data returned from function')
      return
    }

    console.log('✅ Function call successful!')
    console.log('   Profile data:', data.profile ? 'EXISTS' : 'MISSING')
    console.log('   Roles data:', data.roles ? `EXISTS (${data.roles.length} roles)` : 'MISSING')
    console.log('   Primary role:', data.primary_role ? 'EXISTS' : 'MISSING')

    // Test 4: Check RLS status
    console.log('\n4. Checking RLS status...')
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('schemaname', 'public')
      .in('tablename', ['platform_users', 'user_roles'])

    if (rlsError) {
      console.error('❌ Error checking RLS status:', rlsError)
    } else {
      console.log('✅ RLS status:')
      rlsStatus?.forEach(table => {
        console.log(`   - ${table.tablename}: RLS ${table.rowsecurity ? 'ENABLED' : 'DISABLED'}`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testSimpleFunction()
