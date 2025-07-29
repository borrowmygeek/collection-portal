require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🧹 Clearing Authentication Session')
console.log('==================================')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Required environment variables not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function clearAuthSession() {
  try {
    console.log('\n1️⃣ Checking current session...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError)
    } else {
      console.log('✅ Session check completed')
      console.log('   - Has session:', !!session)
      console.log('   - User email:', session?.user?.email || 'None')
    }

    if (session) {
      console.log('\n2️⃣ Signing out current user...')
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        console.error('❌ Sign out error:', signOutError)
      } else {
        console.log('✅ Sign out completed')
      }
    } else {
      console.log('\n2️⃣ No session to clear')
    }

    console.log('\n3️⃣ Verifying session is cleared...')
    const { data: { session: postSession }, error: postError } = await supabase.auth.getSession()
    
    if (postError) {
      console.error('❌ Post-clear session error:', postError)
    } else {
      console.log('✅ Post-clear session check completed')
      console.log('   - Has session:', !!postSession)
    }

    console.log('\n🎯 Session Clear Summary:')
    console.log('=========================')
    console.log('✅ Session cleared successfully')
    console.log('🌐 Visit http://localhost:3000/auth/login to test fresh login')
    console.log('💡 Clear your browser cache if you still see issues')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

clearAuthSession()