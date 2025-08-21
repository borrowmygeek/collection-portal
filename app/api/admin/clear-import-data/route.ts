import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [ADMIN] Starting data cleanup...')
    
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is platform admin
    if (user.activeRole?.roleType !== 'platform_admin') {
      return NextResponse.json({ error: 'Insufficient permissions. Platform admin required.' }, { status: 403 })
    }
    
    // Get Supabase client
    const supabase = createAdminSupabaseClient()
    
    // First, let's check what data exists
    console.log('📊 [ADMIN] Checking current data...')
    
    const { count: personsCount, error: personsCountError } = await supabase
      .from('persons')
      .select('*', { count: 'exact', head: true })
    
    if (personsCountError) {
      console.error('❌ [ADMIN] Error counting persons:', personsCountError)
      return NextResponse.json({ error: 'Failed to count persons' }, { status: 500 })
    }
    
    const { count: debtAccountsCount, error: debtAccountsCountError } = await supabase
      .from('debt_accounts')
      .select('*', { count: 'exact', head: true })
    
    if (debtAccountsCountError) {
      console.error('❌ [ADMIN] Error counting debt_accounts:', debtAccountsCountError)
      return NextResponse.json({ error: 'Failed to count debt accounts' }, { status: 500 })
    }
    
    const { count: stagingDataCount, error: stagingDataError } = await supabase
      .from('import_staging_data')
      .select('*', { count: 'exact', head: true })
    
    if (stagingDataError) {
      console.error('❌ [ADMIN] Error counting staging data:', stagingDataError)
      return NextResponse.json({ error: 'Failed to count staging data' }, { status: 500 })
    }
    
    console.log(`📊 [ADMIN] Found ${personsCount} persons, ${debtAccountsCount} debt accounts, ${stagingDataCount} staging rows`)
    
    if ((!personsCount || personsCount === 0) && (!debtAccountsCount || debtAccountsCount === 0) && (!stagingDataCount || stagingDataCount === 0)) {
      return NextResponse.json({ 
        success: true, 
        message: 'No data to clear! All tables are already empty.',
        cleared: {
          persons: 0,
          debtAccounts: 0,
          stagingData: 0
        }
      })
    }
    
    // Clear satellite tables FIRST (due to foreign key constraints)
    console.log('🗑️ [ADMIN] Clearing satellite tables first...')
    
    const satelliteTables = [
      'person_addresses',
      'person_phones', 
      'person_emails',
      'import_performance_metrics'
    ]
    
    let satelliteCleared = 0
    for (const table of satelliteTables) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')
        
        if (error) {
          console.warn(`⚠️ [ADMIN] Warning clearing ${table}:`, error.message)
        } else {
          console.log(`✅ [ADMIN] ${table} table cleared`)
          satelliteCleared++
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.warn(`⚠️ [ADMIN] Warning clearing ${table}:`, errorMessage)
      }
    }
    
    // Clear import staging data
    if (stagingDataCount && stagingDataCount > 0) {
      console.log('🗑️ [ADMIN] Clearing import staging data...')
      const { error: stagingError } = await supabase
        .from('import_staging_data')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      
      if (stagingError) {
        console.error('❌ [ADMIN] Error clearing staging data:', stagingError)
        return NextResponse.json({ error: 'Failed to clear staging data' }, { status: 500 })
      }
      console.log('✅ [ADMIN] Import staging data cleared')
    }
    
    // Clear debt_accounts (references persons)
    if (debtAccountsCount && debtAccountsCount > 0) {
      console.log('🗑️ [ADMIN] Clearing debt_accounts table...')
      const { error: debtAccountsError } = await supabase
        .from('debt_accounts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      
      if (debtAccountsError) {
        console.error('❌ [ADMIN] Error clearing debt_accounts:', debtAccountsError)
        return NextResponse.json({ error: 'Failed to clear debt accounts' }, { status: 500 })
      }
      console.log('✅ [ADMIN] debt_accounts table cleared')
    }
    
    // Finally clear persons table (now that all references are gone)
    if (personsCount && personsCount > 0) {
      console.log('🗑️ [ADMIN] Clearing persons table...')
      const { error: personsError } = await supabase
        .from('persons')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      
      if (personsError) {
        console.error('❌ [ADMIN] Error clearing persons:', personsError)
        return NextResponse.json({ error: 'Failed to clear persons' }, { status: 500 })
      }
      console.log('✅ [ADMIN] persons table cleared')
    }
    
    // Verify cleanup
    console.log('🔍 [ADMIN] Verifying cleanup...')
    
    const { count: finalPersonsCount } = await supabase
      .from('persons')
      .select('*', { count: 'exact', head: true })
    
    const { count: finalDebtAccountsCount } = await supabase
      .from('debt_accounts')
      .select('*', { count: 'exact', head: true })
    
    const { count: finalStagingCount } = await supabase
      .from('import_staging_data')
      .select('*', { count: 'exact', head: true })
    
    console.log(`✅ [ADMIN] Final counts: ${finalPersonsCount} persons, ${finalDebtAccountsCount} debt accounts, ${finalStagingCount} staging rows`)
    
    if (finalPersonsCount === 0 && finalDebtAccountsCount === 0 && finalStagingCount === 0) {
      console.log('🎉 [ADMIN] Data cleanup completed successfully!')
      
      return NextResponse.json({
        success: true,
        message: `Data cleared successfully! Cleared ${personsCount} persons, ${debtAccountsCount} debt accounts, ${stagingDataCount} staging rows, and ${satelliteCleared} satellite tables.`,
        cleared: {
          persons: personsCount,
          debtAccounts: debtAccountsCount,
          stagingData: stagingDataCount,
          satelliteTables: satelliteCleared
        }
      })
    } else {
      console.log('⚠️ [ADMIN] Some data may still remain')
      
      return NextResponse.json({
        success: true,
        message: `Data cleared with warnings. Some data may still remain.`,
        cleared: {
          persons: personsCount,
          debtAccounts: debtAccountsCount,
          stagingData: stagingDataCount,
          satelliteTables: satelliteCleared
        },
        remaining: {
          persons: finalPersonsCount,
          debtAccounts: finalDebtAccountsCount,
          stagingData: finalStagingCount
        }
      })
    }
    
  } catch (error) {
    console.error('❌ [ADMIN] Unexpected error during data cleanup:', error)
    
    return NextResponse.json({ 
      error: 'Data cleanup failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
