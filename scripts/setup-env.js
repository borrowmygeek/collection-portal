const fs = require('fs')
const path = require('path')

console.log('🔧 Setting up environment variables for sales schema deployment...')

// Read the supabase config
const supabaseConfigPath = path.join(__dirname, '..', 'supabase_config.json')
const supabaseConfig = JSON.parse(fs.readFileSync(supabaseConfigPath, 'utf8'))

console.log('\n📋 Current Supabase Configuration:')
console.log(`URL: ${supabaseConfig.supabase_url}`)
console.log(`Anon Key: ${supabaseConfig.supabase_anon_key.substring(0, 20)}...`)

console.log('\n⚠️  To deploy the sales schema, you need to:')
console.log('1. Go to your Supabase dashboard:')
console.log(`   https://supabase.com/dashboard/project/nczrnzqbthaqnrcupneu/settings/api`)
console.log('2. Copy the "service_role" key (not the anon key)')
console.log('3. Set it as an environment variable:')
console.log('\n   PowerShell:')
console.log('   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"')
console.log('\n   Or create a .env.local file with:')
console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')

console.log('\n🔑 The service role key starts with "eyJ..." and is much longer than the anon key')
console.log('⚠️  Keep this key secure - it has full database access!')

console.log('\n📝 Once you have the service role key, run:')
console.log('node scripts/apply-migration.js sales_module_schema.sql') 