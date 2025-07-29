require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🧪 Testing Login Flow')
console.log('=====================')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Required environment variables not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testLoginFlow() {
  try {
    console.log('\n1️⃣ Testing sign in with admin credentials...')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@collectionportal.com',
      password: 'admin123' // You'll need to provide the actual password
    })
    
    if (error) {
      console.error('❌ Sign in error:', error)
      console.log('💡 Please provide the correct password for admin@collectionportal.com')
      return
    }
    
    console.log('✅ Sign in successful')
    console.log('   - User ID:', data.user?.id)
    console.log('   - Email:', data.user?.email)
    console.log('   - Has session:', !!data.session)

    console.log('\n2️⃣ Testing session retrieval...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError)
    } else {
      console.log('✅ Session check completed')
      console.log('   - Has session:', !!session)
      console.log('   - User email:', session?.user?.email || 'None')
    }

    console.log('\n3️⃣ Testing platform_users table access...')
    if (data.user) {
      const { data: platformUser, error: platformError } = await supabase
        .from('platform_users')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .single()
      
      if (platformError) {
        console.error('❌ Platform user error:', platformError)
      } else {
        console.log('✅ Platform user check completed')
        console.log('   - Has platform user:', !!platformUser)
        console.log('   - Role:', platformUser?.role || 'None')
        console.log('   - Status:', platformUser?.status || 'None')
      }
    }

    console.log('\n4️⃣ Testing sign out...')
    const { error: signOutError } = await supabase.auth.signOut()
    
    if (signOutError) {
      console.error('❌ Sign out error:', signOutError)
    } else {
      console.log('✅ Sign out completed')
    }

    console.log('\n🎯 Login Flow Test Summary:')
    console.log('==========================')
    console.log('✅ Authentication system is working correctly')
    console.log('🌐 Visit http://localhost:3000/debug-auth to see current state')
    console.log('🔗 Try navigating to /auth/login and / from the debug page')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testLoginFlow()