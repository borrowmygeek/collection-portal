// Debug Profile Fetch - Comprehensive Diagnostic Script
// This script tests each step of the profile fetch process to identify bottlenecks

const { createClient } = require('@supabase/supabase-js')
const path = require('path')

// Load environment variables from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

// Check environment variables first
function checkEnvironment() {
  console.log('🔍 [ENV] Checking environment configuration...')
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ [ENV] Missing environment variables:', missingVars)
    console.error('❌ [ENV] Make sure you have a .env file in the project root with:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
    console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
    return false
  }
  
  console.log('✅ [ENV] All required environment variables present')
  console.log('✅ [ENV] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing')
  console.log('✅ [ENV] Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing')
  return true
}

// Create Supabase client only if environment is valid
let supabase = null

async function testDatabaseConnection() {
  console.log('🔍 [DIAGNOSTIC] Testing database connection...')
  
  try {
    const startTime = Date.now()
    const { data, error } = await supabase
      .from('platform_users')
      .select('id')
      .limit(1)
    
    const responseTime = Date.now() - startTime
    
    if (error) {
      console.error('❌ [DIAGNOSTIC] Database connection failed:', error)
      return false
    }
    
    console.log(`✅ [DIAGNOSTIC] Database connection successful in ${responseTime}ms`)
    return true
  } catch (err) {
    console.error('❌ [DIAGNOSTIC] Database connection exception:', err)
    return false
  }
}

async function testPlatformUsersQuery(userId) {
  console.log(`🔍 [DIAGNOSTIC] Testing platform_users query for user: ${userId}`)
  
  try {
    const startTime = Date.now()
    const { data, error } = await supabase
      .from('platform_users')
      .select('id, email, auth_user_id, full_name, status')
      .eq('auth_user_id', userId)
      .single()
    
    const responseTime = Date.now() - startTime
    
    if (error) {
      console.error('❌ [DIAGNOSTIC] platform_users query failed:', error)
      return null
    }
    
    console.log(`✅ [DIAGNOSTIC] platform_users query successful in ${responseTime}ms:`, data)
    return data
  } catch (err) {
    console.error('❌ [DIAGNOSTIC] platform_users query exception:', err)
    return null
  }
}

async function testGetUserActiveRole(userId) {
  console.log(`🔍 [DIAGNOSTIC] Testing get_user_active_role RPC for user: ${userId}`)
  
  try {
    const startTime = Date.now()
    const { data, error } = await supabase.rpc('get_user_active_role', { 
      p_user_id: userId,
      p_session_token: null
    })
    
    const responseTime = Date.now() - startTime
    
    if (error) {
      console.error('❌ [DIAGNOSTIC] get_user_active_role RPC failed:', error)
      return null
    }
    
    console.log(`✅ [DIAGNOSTIC] get_user_active_role RPC successful in ${responseTime}ms:`, data)
    return data
  } catch (err) {
    console.error('❌ [DIAGNOSTIC] get_user_active_role RPC exception:', err)
    return null
  }
}

async function testGetUserRolesSimple(userId) {
  console.log(`🔍 [DIAGNOSTIC] Testing get_user_roles_simple RPC for user: ${userId}`)
  
  try {
    const startTime = Date.now()
    const { data, error } = await supabase.rpc('get_user_roles_simple', { 
      p_user_id: userId
    })
    
    const responseTime = Date.now() - startTime
    
    if (error) {
      console.error('❌ [DIAGNOSTIC] get_user_roles_simple RPC failed:', error)
      return null
    }
    
    console.log(`✅ [DIAGNOSTIC] get_user_roles_simple RPC successful in ${responseTime}ms:`, data)
    return data
  } catch (err) {
    console.error('❌ [DIAGNOSTIC] get_user_roles_simple RPC exception:', err)
    return null
  }
}

async function runFullDiagnostic() {
  console.log('🚀 [DIAGNOSTIC] Starting comprehensive profile fetch diagnostic...')
  console.log('=' .repeat(80))
  
  // Check environment first
  const envOk = checkEnvironment()
  if (!envOk) {
    console.error('❌ [DIAGNOSTIC] Cannot proceed - environment configuration invalid')
    return
  }
  
  // Create Supabase client
  try {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    console.log('✅ [DIAGNOSTIC] Supabase client created successfully')
  } catch (error) {
    console.error('❌ [DIAGNOSTIC] Failed to create Supabase client:', error)
    return
  }
  
  console.log('')
  
  // Test database connection
  const connectionOk = await testDatabaseConnection()
  if (!connectionOk) {
    console.error('❌ [DIAGNOSTIC] Cannot proceed - database connection failed')
    return
  }
  
  console.log('')
  
  // Test with a known user ID (replace with actual user ID from your logs)
  const testUserId = '9c522336-9e48-4499-a235-32017e2ab413'
  
  // Test platform_users query
  const profileData = await testPlatformUsersQuery(testUserId)
  if (!profileData) {
    console.error('❌ [DIAGNOSTIC] Cannot proceed - platform_users query failed')
    return
  }
  
  console.log('')
  
  // Test get_user_active_role RPC
  const activeRole = await testGetUserActiveRole(profileData.id)
  if (!activeRole) {
    console.error('❌ [DIAGNOSTIC] Cannot proceed - get_user_active_role RPC failed')
    return
  }
  
  console.log('')
  
  // Test get_user_roles_simple RPC
  const allRoles = await testGetUserRolesSimple(profileData.id)
  if (!allRoles) {
    console.error('❌ [DIAGNOSTIC] Cannot proceed - get_user_roles_simple RPC failed')
    return
  }
  
  console.log('')
  console.log('✅ [DIAGNOSTIC] All tests passed! Profile fetch should work correctly.')
  console.log('=' .repeat(80))
}

// Run the diagnostic
runFullDiagnostic().catch(console.error)
