// Debug Vercel Deployment - Check for caching and version issues
// This script helps identify if Vercel is serving multiple code versions

const https = require('https')
const fs = require('fs')
const path = require('path')

// Load environment variables from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const VERCEL_URL = 'https://collection-portal-zeta.vercel.app'

async function checkVercelDeployment() {
  console.log('🚀 [VERCEL] Checking Vercel deployment status...')
  console.log('=' .repeat(80))
  
  try {
    // Check main page response
    console.log('🔍 [VERCEL] Checking main page response...')
    const mainPageResponse = await makeRequest(`${VERCEL_URL}/`)
    console.log(`✅ [VERCEL] Main page status: ${mainPageResponse.status}`)
    console.log(`✅ [VERCEL] Main page response time: ${mainPageResponse.responseTime}ms`)
    
    // Check if we can access auth context
    console.log('🔍 [VERCEL] Checking auth context accessibility...')
    const authResponse = await makeRequest(`${VERCEL_URL}/api/auth/roles`)
    console.log(`✅ [VERCEL] Auth API status: ${authResponse.status}`)
    console.log(`✅ [VERCEL] Auth API response time: ${authResponse.responseTime}ms`)
    
    // Check for multiple JavaScript bundles (indicates multiple versions)
    console.log('🔍 [VERCEL] Checking for multiple JavaScript bundles...')
    const jsBundles = await findJavaScriptBundles(mainPageResponse.body)
    console.log(`✅ [VERCEL] Found ${jsBundles.length} JavaScript bundles:`)
    jsBundles.forEach((bundle, index) => {
      console.log(`   ${index + 1}. ${bundle}`)
    })
    
    // Check deployment headers
    console.log('🔍 [VERCEL] Checking deployment headers...')
    const deploymentInfo = await getDeploymentInfo()
    console.log('✅ [VERCEL] Deployment info:', deploymentInfo)
    
  } catch (error) {
    console.error('❌ [VERCEL] Error checking deployment:', error.message)
  }
}

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    const req = https.get(url, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body,
          responseTime: responseTime
        })
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

async function findJavaScriptBundles(htmlBody) {
  const jsBundleRegex = /[a-f0-9]{8,}\.js/g
  const matches = htmlBody.match(jsBundleRegex) || []
  return [...new Set(matches)] // Remove duplicates
}

async function getDeploymentInfo() {
  try {
    const response = await makeRequest(`${VERCEL_URL}/_vercel/insights`)
    return {
      hasInsights: response.status === 200,
      status: response.status
    }
  } catch (error) {
    return {
      hasInsights: false,
      error: error.message
    }
  }
}

// Check for environment-specific issues
function checkEnvironment() {
  console.log('🔍 [ENV] Checking environment configuration...')
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ [ENV] Missing environment variables:', missingVars)
  } else {
    console.log('✅ [ENV] All required environment variables present')
  }
  
  console.log('✅ [ENV] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing')
  console.log('✅ [ENV] Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing')
}

// Run the diagnostic
async function runVercelDiagnostic() {
  console.log('🚀 [VERCEL] Starting Vercel deployment diagnostic...')
  console.log('=' .repeat(80))
  
  checkEnvironment()
  console.log('')
  
  await checkVercelDeployment()
  
  console.log('')
  console.log('📋 [VERCEL] Diagnostic complete. Check the results above.')
  console.log('=' .repeat(80))
}

runVercelDiagnostic().catch(console.error)
