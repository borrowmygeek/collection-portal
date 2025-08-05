const fs = require('fs')

// List of final routes that need fixing
const finalRoutes = [
  'app/api/persons/route.ts',
  'app/api/migrations/route.ts',
  'app/api/debtors/route.ts',
  'app/api/debug/import-status/route.ts'
]

function fixFinalRoute(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    
    // Check if file already uses admin client
    if (content.includes('createAdminSupabaseClient')) {
      console.log(`✅ ${filePath} - Already fixed`)
      return
    }
    
    // Replace the simple pattern without error handling
    content = content.replace(
      /const createSupabaseClient = \(\) => \{\s*const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL\s*const supabaseAnonKey = process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY\s*\s*if \(!supabaseUrl \|\| !supabaseAnonKey\) \{\s*throw new Error\('Supabase environment variables not configured'\)\s*\}\s*\s*return createClient\(supabaseUrl, supabaseAnonKey\)\s*\}/g,
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

console.log('🔧 Fixing final API routes...\n')

finalRoutes.forEach(route => {
  fixFinalRoute(route)
})

console.log('\n🎉 All final routes have been updated!') 