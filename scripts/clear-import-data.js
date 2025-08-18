const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

async function clearImportData() {
  console.log('🧹 Starting data cleanup...')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    // First, let's check what data exists
    console.log('📊 Checking current data...')
    
    const { data: personsCount, error: personsCountError } = await supabase
      .from('persons')
      .select('id', { count: 'exact', head: true })
    
    if (personsCountError) {
      console.error('❌ Error counting persons:', personsCountError)
      return
    }
    
    const { data: debtAccountsCount, error: debtAccountsCountError } = await supabase
      .from('debt_accounts')
      .select('id', { count: 'exact', head: true })
    
    if (debtAccountsCountError) {
      console.error('❌ Error counting debt_accounts:', debtAccountsCountError)
      return
    }
    
    console.log(`📊 Found ${personsCount} persons and ${debtAccountsCount} debt accounts`)
    
    if (personsCount === 0 && debtAccountsCount === 0) {
      console.log('✅ No data to clear!')
      return
    }
    
    // Clear debt_accounts first (due to foreign key constraints)
    if (debtAccountsCount > 0) {
      console.log('🗑️ Clearing debt_accounts table...')
      const { error: debtAccountsError } = await supabase
        .from('debt_accounts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
      
      if (debtAccountsError) {
        console.error('❌ Error clearing debt_accounts:', debtAccountsError)
        return
      }
      console.log('✅ debt_accounts table cleared')
    }
    
    // Clear persons table
    if (personsCount > 0) {
      console.log('🗑️ Clearing persons table...')
      const { error: personsError } = await supabase
        .from('persons')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
      
      if (personsError) {
        console.error('❌ Error clearing persons:', personsError)
        return
      }
      console.log('✅ persons table cleared')
    }
    
    // Also clear related satellite tables
    console.log('🗑️ Clearing satellite tables...')
    
    const satelliteTables = [
      'person_addresses',
      'person_phones', 
      'person_emails',
      'import_performance_metrics'
    ]
    
    for (const table of satelliteTables) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')
        
        if (error) {
          console.warn(`⚠️ Warning clearing ${table}:`, error.message)
        } else {
          console.log(`✅ ${table} table cleared`)
        }
      } catch (err) {
        console.warn(`⚠️ Warning clearing ${table}:`, err.message)
      }
    }
    
    // Verify cleanup
    console.log('🔍 Verifying cleanup...')
    
    const { count: finalPersonsCount } = await supabase
      .from('persons')
      .select('*', { count: 'exact', head: true })
    
    const { count: finalDebtAccountsCount } = await supabase
      .from('debt_accounts')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Final counts: ${finalPersonsCount} persons, ${finalDebtAccountsCount} debt accounts`)
    
    if (finalPersonsCount === 0 && finalDebtAccountsCount === 0) {
      console.log('🎉 Data cleanup completed successfully!')
    } else {
      console.log('⚠️ Some data may still exist')
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the cleanup
clearImportData()
  .then(() => {
    console.log('🏁 Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
