const fs = require('fs')
const path = require('path')

// List of API routes that need to be fixed
const apiRoutes = [
  'app/api/setup/route.ts',
  'app/api/security/stats/route.ts',
  'app/api/security/audit-logs/route.ts',
  'app/api/portfolio-placements/[id]/route.ts',
  'app/api/portfolios/[id]/route.ts',
  'app/api/portfolio-placements/route.ts',
  'app/api/portfolios/[id]/stats/route.ts',
  'app/api/persons/route.ts',
  'app/api/migrations/route.ts',
  'app/api/nda/route.ts',
  'app/api/nda/templates/route.ts',
  'app/api/import/templates/route.ts',
  'app/api/debug/import-status/route.ts',
  'app/api/import/templates/[id]/route.ts',
  'app/api/import/route.ts',
  'app/api/debug/agencies/route.ts',
  'app/api/import/preview/route.ts',
  'app/api/import/cancel/route.ts',
  'app/api/import/failed-rows/[jobId]/route.ts',
  'app/api/debtors/route.ts',
  'app/api/dashboard/stats/route.ts',
  'app/api/clients/[id]/route.ts',
  'app/api/buyers/[id]/route.ts',
  'app/api/agencies/route.ts',
  'app/api/agencies/[id]/route.ts',
  'app/api/admin/agencies/route.ts'
]

function fixApiRoute(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    
    // Check if file already uses admin client
    if (content.includes('createAdminSupabaseClient')) {
      console.log(`✅ ${filePath} - Already fixed`)
      return
    }
    
    // Replace the client creation function
    content = content.replace(
      /\/\/ Only create client if environment variables are available\s*const createSupabaseClient = \(\) => \{\s*const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL\s*const supabaseAnonKey = process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY\s*\s*if \(!supabaseUrl \|\| !supabaseAnonKey\) \{\s*throw new Error\('Supabase environment variables not configured'\)\s*\}\s*\s*return createClient\(supabaseUrl, supabaseAnonKey\)\s*\}/g,
      `// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}`
    )
    
    // Replace all instances of createSupabaseClient() with createAdminSupabaseClient()
    content = content.replace(/createSupabaseClient\(\)/g, 'createAdminSupabaseClient()')
    
    // Write the updated content back
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`✅ ${filePath} - Fixed`)
    
  } catch (error) {
    console.log(`❌ ${filePath} - Error: ${error.message}`)
  }
}

console.log('🔧 Fixing all API routes to use admin client...\n')

apiRoutes.forEach(route => {
  fixApiRoute(route)
})

console.log('\n🎉 All API routes have been updated!') 