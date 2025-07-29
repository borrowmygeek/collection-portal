const { createClient } = require('@supabase/supabase-js')

// This script temporarily disables RLS on the debtors table to fix import issues
// Run this script before imports, then re-enable RLS after

const supabaseUrl = 'https://nczrnzqbthaqnrcupneu.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  console.log('Please set the service role key in your environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function disableRLS() {
  console.log('🔧 Disabling RLS on debtors table...')
  
  try {
    const { error } = await supabase.rpc('disable_rls_for_table', { 
      table_name: 'debtors' 
    })
    
    if (error) {
      console.error('❌ Error disabling RLS:', error)
      return false
    }
    
    console.log('✅ RLS disabled successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to disable RLS:', error)
    return false
  }
}

async function enableRLS() {
  console.log('🔧 Re-enabling RLS on debtors table...')
  
  try {
    const { error } = await supabase.rpc('enable_rls_for_table', { 
      table_name: 'debtors' 
    })
    
    if (error) {
      console.error('❌ Error enabling RLS:', error)
      return false
    }
    
    console.log('✅ RLS enabled successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to enable RLS:', error)
    return false
  }
}

async function checkRLSStatus() {
  console.log('🔍 Checking RLS status...')
  
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('row_security')
      .eq('table_name', 'debtors')
      .single()
    
    if (error) {
      console.error('❌ Error checking RLS status:', error)
      return
    }
    
    console.log(`📊 RLS Status: ${data.row_security ? 'ENABLED' : 'DISABLED'}`)
  } catch (error) {
    console.error('❌ Failed to check RLS status:', error)
  }
}

async function main() {
  const action = process.argv[2]
  
  if (!action) {
    console.log('Usage: node scripts/fix-import-rls.js [disable|enable|check]')
    console.log('  disable - Disable RLS on debtors table')
    console.log('  enable  - Enable RLS on debtors table')
    console.log('  check   - Check current RLS status')
    process.exit(1)
  }
  
  switch (action) {
    case 'disable':
      await disableRLS()
      break
    case 'enable':
      await enableRLS()
      break
    case 'check':
      await checkRLSStatus()
      break
    default:
      console.log('❌ Invalid action. Use: disable, enable, or check')
      process.exit(1)
  }
}

main().catch(console.error) 