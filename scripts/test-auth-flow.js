require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔧 Testing Authentication Flow')
console.log('==============================')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Required environment variables not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testAuthFlow() {
  try {
    console.log('\n1️⃣ Testing session retrieval...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError)
    } else {
      console.log('✅ Session check completed')
      console.log('   - Has session:', !!session)
      console.log('   - User email:', session?.user?.email || 'None')
    }

    console.log('\n2️⃣ Testing user retrieval...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ User error:', userError)
    } else {
      console.log('✅ User check completed')
      console.log('   - Has user:', !!user)
      console.log('   - User email:', user?.email || 'None')
    }

    console.log('\n3️⃣ Testing platform_users table access...')
    if (user) {
      const { data: platformUser, error: platformError } = await supabase
        .from('platform_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()
      
      if (platformError) {
        console.error('❌ Platform user error:', platformError)
      } else {
        console.log('✅ Platform user check completed')
        console.log('   - Has platform user:', !!platformUser)
        console.log('   - Role:', platformUser?.role || 'None')
        console.log('   - Status:', platformUser?.status || 'None')
      }
    } else {
      console.log('⚠️  No user to check platform_users')
    }

    console.log('\n4️⃣ Testing sign out...')
    const { error: signOutError } = await supabase.auth.signOut()
    
    if (signOutError) {
      console.error('❌ Sign out error:', signOutError)
    } else {
      console.log('✅ Sign out completed')
    }

    console.log('\n5️⃣ Testing post-signout session...')
    const { data: { session: postSession }, error: postError } = await supabase.auth.getSession()
    
    if (postError) {
      console.error('❌ Post-signout session error:', postError)
    } else {
      console.log('✅ Post-signout session check completed')
      console.log('   - Has session:', !!postSession)
    }

    console.log('\n🎯 Authentication Flow Test Summary:')
    console.log('====================================')
    console.log('✅ All tests completed')
    console.log('📝 Check the browser console for middleware logs')
    console.log('🌐 Visit http://localhost:3000 to test the full flow')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testAuthFlow()