#!/usr/bin/env node

/**
 * Test script to verify timeout functionality
 * This simulates the timeout logic we implemented in auth-context.tsx
 */

console.log('🧪 Testing timeout functionality...\n')

// Simulate the timeout logic from auth-context.tsx
async function testTimeout() {
  console.log('⏱️  Starting timeout test...')
  
  try {
    // Create a timeout promise that will definitely reject
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log('⏰ [TEST] Timeout triggered after 3 seconds')
        reject(new Error('Test timeout after 3 seconds'))
      }, 3000)
    })

    // Create a promise that takes longer than the timeout
    const slowPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log('🐌 [TEST] Slow promise completed after 5 seconds')
        resolve('Slow result')
      }, 5000)
    })

    console.log('🔍 [TEST] Racing slow promise against 3-second timeout...')
    
    // Race between timeout and slow promise
    const result = await Promise.race([slowPromise, timeoutPromise])
    
    console.log('✅ [TEST] Unexpected success:', result)
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log('✅ [TEST] Timeout working correctly!')
      console.log('   Error message:', error.message)
    } else {
      console.log('❌ [TEST] Unexpected error:', error)
    }
  }
}

// Test 2: Fast promise should succeed
async function testFastPromise() {
  console.log('\n🚀 Testing fast promise (should succeed)...')
  
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log('⏰ [TEST] Timeout triggered after 3 seconds')
        reject(new Error('Test timeout after 3 seconds'))
      }, 3000)
    })

    // Create a fast promise that completes before timeout
    const fastPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log('⚡ [TEST] Fast promise completed after 1 second')
        resolve('Fast result')
      }, 1000)
    })

    console.log('🔍 [TEST] Racing fast promise against 3-second timeout...')
    
    // Race between timeout and fast promise
    const result = await Promise.race([fastPromise, timeoutPromise])
    
    console.log('✅ [TEST] Fast promise succeeded as expected:', result)
    
  } catch (error) {
    console.log('❌ [TEST] Fast promise failed unexpectedly:', error)
  }
}

// Run tests
async function runTests() {
  await testTimeout()
  await testFastPromise()
  
  console.log('\n🎯 Test summary:')
  console.log('   - Timeout test: Should show timeout after 3 seconds')
  console.log('   - Fast promise test: Should succeed in 1 second')
  console.log('\n✅ Timeout functionality test completed!')
}

runTests().catch(console.error)
