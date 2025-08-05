const fs = require('fs')
const path = require('path')

// Function to recursively find all TypeScript files
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findTsFiles(filePath, fileList)
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath)
    }
  })
  
  return fileList
}

// Function to update service role key usage
function updateServiceRoleUsage(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  let updated = false
  
  // Replace service role key with anon key
  if (content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    content = content.replace(
      /const supabaseServiceKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY/g,
      'const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
    
    content = content.replace(
      /supabaseServiceKey/g,
      'supabaseAnonKey'
    )
    
    updated = true
    console.log(`✅ Updated: ${filePath}`)
  }
  
  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8')
  }
}

// Main execution
console.log('🔧 Starting service role key replacement...')

const apiDir = path.join(__dirname, '..', 'app', 'api')
const tsFiles = findTsFiles(apiDir)

console.log(`📁 Found ${tsFiles.length} TypeScript files in API directory`)

tsFiles.forEach(filePath => {
  updateServiceRoleUsage(filePath)
})

console.log('✅ Service role key replacement completed!')
console.log('⚠️  IMPORTANT: You may need to update some routes to use admin client for privileged operations') 