const fetch = require('node-fetch')

// Test the API routes to see what's happening
async function testApiRoutes() {
  const baseUrl = 'https://collection-portal-zeta.vercel.app'
  
  console.log('🔧 Testing API Routes...')
  
  // Test routes that should work
  const testRoutes = [
    '/api/auth/roles',
    '/api/buyers',
    '/api/sales/stats',
    '/api/sales',
    '/api/portfolios',
    '/api/clients'
  ]
  
  for (const route of testRoutes) {
    try {
      console.log(`\n🔍 Testing: ${route}`)
      
      const response = await fetch(`${baseUrl}${route}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Note: This will fail without auth, but we want to see the error
        }
      })
      
      console.log(`✅ Status: ${response.status}`)
      
      if (response.status !== 200) {
        const errorText = await response.text()
        console.log(`❌ Error: ${errorText.substring(0, 200)}...`)
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`)
    }
  }
}

testApiRoutes() 