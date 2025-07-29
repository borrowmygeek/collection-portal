require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Environment check:')
console.log('- Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
console.log('- Service Key:', supabaseServiceKey ? '✅ Set' : '❌ Missing')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Required environment variables not set')
  console.log('Please ensure .env.local file exists with:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL')
  console.log('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAuthStatus() {
  try {
    console.log('🔍 Checking authentication status...')
    
    // Check platform_users table
    console.log('\n📋 Checking platform_users table...')
    const { data: platformUsers, error: platformError } = await supabase
      .from('platform_users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (platformError) {
      console.error('❌ Error fetching platform users:', platformError)
    } else {
      console.log(`✅ Found ${platformUsers?.length || 0} platform users:`)
      if (platformUsers && platformUsers.length > 0) {
        platformUsers.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.email} (${user.role}) - ${user.status}`)
        })
      }
    }
    
    // Check auth.users table
    console.log('\n🔐 Checking auth.users table...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
    } else {
      console.log(`✅ Found ${authUsers?.users?.length || 0} auth users:`)
      if (authUsers?.users && authUsers.users.length > 0) {
        authUsers.users.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.email} - ${user.email_confirmed_at ? 'confirmed' : 'unconfirmed'}`)
        })
      }
    }
    
    console.log('\n🎯 Summary:')
    console.log(`- Platform users: ${platformUsers?.length || 0}`)
    console.log(`- Auth users: ${authUsers?.users?.length || 0}`)
    
    if (platformUsers?.length === 0 && authUsers?.users?.length > 0) {
      console.log('⚠️  WARNING: Auth users exist but no platform users found!')
      console.log('   This suggests the trigger may not be working properly.')
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkAuthStatus()