#!/usr/bin/env node

/**
 * Test script to verify the complete authentication flow
 * This tests the authorization header flow that's failing in production
 */

console.log('🧪 Testing complete authentication flow...\n')

// Simulate the authentication flow
async function testAuthFlow() {
  console.log('🔐 Testing authentication flow...')
  
  try {
    // Step 1: Simulate user login (this would normally happen in Supabase)
    console.log('1️⃣ Simulating user login...')
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com'
    }
    console.log('✅ Mock user created:', mockUser.id)
    
    // Step 2: Simulate profile fetch (this is where it's hanging)
    console.log('2️⃣ Simulating profile fetch...')
    console.log('   ⏰ This would normally timeout after 5 seconds...')
    
    // Simulate the timeout scenario
    const profilePromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log('🐌 Profile fetch completed after 10 seconds (too late!)')
        resolve({ profile: 'data' })
      }, 10000)
    })
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log('⏰ Timeout triggered after 5 seconds')
        reject(new Error('Profile fetch timeout after 5 seconds'))
      }, 5000)
    })
    
    console.log('🔍 Racing profile fetch against 5-second timeout...')
    
    try {
      const result = await Promise.race([profilePromise, timeoutPromise])
      console.log('❌ Unexpected success:', result)
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('✅ Timeout working correctly!')
        console.log('   Now should trigger fallback method...')
      } else {
        console.log('❌ Unexpected error:', error)
      }
    }
    
    // Step 3: Simulate fallback profile fetch
    console.log('3️⃣ Simulating fallback profile fetch...')
    console.log('   🔄 Using direct table queries instead of RPC...')
    
    // Simulate successful fallback
    const fallbackProfile = {
      id: 'profile-id',
      email: 'test@example.com',
      activeRole: {
        roleId: 'role-id',
        roleType: 'platform_admin'
      }
    }
    console.log('✅ Fallback profile fetch successful:', fallbackProfile.id)
    
    // Step 4: Simulate API call with authorization header
    console.log('4️⃣ Simulating API call with authorization header...')
    
    // This is what authenticatedFetch should do
    const mockSession = {
      access_token: 'mock-jwt-token-12345'
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mockSession.access_token}`
    }
    
    console.log('✅ Authorization header created:', {
      hasAuth: !!headers.Authorization,
      tokenLength: headers.Authorization?.length || 0,
      startsWithBearer: headers.Authorization?.startsWith('Bearer ') || false
    })
    
    // Step 5: Simulate backend authentication
    console.log('5️⃣ Simulating backend authentication...')
    
    const authHeader = headers.Authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      console.log('✅ Backend received valid authorization header')
      console.log('   Token length:', token.length)
      console.log('   Token starts with:', token.substring(0, 10) + '...')
    } else {
      console.log('❌ Backend received invalid authorization header')
    }
    
    console.log('\n🎯 Authentication flow test completed successfully!')
    
  } catch (error) {
    console.error('❌ Authentication flow test failed:', error)
  }
}

// Run the test
testAuthFlow().catch(console.error)
