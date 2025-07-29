const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRLSStatus() {
  console.log('🔍 Checking RLS status and policies...\n')

  try {
    // Check if RLS is enabled on debtors table
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('check_rls_status', { table_name: 'debtors' })
      .single()

    if (rlsError) {
      console.log('❌ Could not check RLS status directly, checking policies...')
    } else {
      console.log(`📊 RLS Status for debtors table: ${rlsStatus ? 'ENABLED' : 'DISABLED'}`)
    }

    // Check existing policies
    const { data: policies, error: policiesError } = await supabase
      .from('information_schema.policies')
      .select('*')
      .eq('table_name', 'debtors')

    if (policiesError) {
      console.error('❌ Error fetching policies:', policiesError)
    } else {
      console.log(`📋 Found ${policies.length} policies on debtors table:`)
      policies.forEach(policy => {
        console.log(`  - ${policy.policy_name}: ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} ${policy.operation}`)
      })
    }

    // Test a simple insert to see if it works
    console.log('\n🧪 Testing insert with service role...')
    
    const testData = {
      account_number: 'TEST-ACCOUNT-001',
      original_balance: 1000.00,
      current_balance: 1000.00,
      portfolio_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      client_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      created_by: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      status: 'new',
      collection_status: 'new',
      collection_priority: 'normal',
      account_status: 'active'
    }

    const { data: insertResult, error: insertError } = await supabase
      .from('debtors')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('❌ Insert test failed:', insertError)
      console.error('Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      })
    } else {
      console.log('✅ Insert test successful!')
      console.log('Inserted record ID:', insertResult[0].id)
      
      // Clean up test record
      await supabase
        .from('debtors')
        .delete()
        .eq('id', insertResult[0].id)
      console.log('🧹 Cleaned up test record')
    }

    // Check if we can query existing records
    console.log('\n🔍 Testing query with service role...')
    const { data: existingRecords, error: queryError } = await supabase
      .from('debtors')
      .select('id, account_number, created_at')
      .limit(5)

    if (queryError) {
      console.error('❌ Query test failed:', queryError)
    } else {
      console.log(`✅ Query test successful! Found ${existingRecords.length} records`)
      if (existingRecords.length > 0) {
        console.log('Sample records:', existingRecords.slice(0, 2))
      }
    }

  } catch (error) {
    console.error('❌ Error in RLS check:', error)
  }
}

async function checkImportJobs() {
  console.log('\n📊 Checking recent import jobs...\n')

  try {
    const { data: jobs, error } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('❌ Error fetching import jobs:', error)
      return
    }

    console.log(`Found ${jobs.length} recent import jobs:`)
    jobs.forEach(job => {
      console.log(`  - ${job.id}: ${job.status} (${job.successful_rows || 0} successful, ${job.failed_rows || 0} failed)`)
      if (job.errors) {
        console.log(`    Errors: ${JSON.stringify(job.errors)}`)
      }
    })

  } catch (error) {
    console.error('❌ Error checking import jobs:', error)
  }
}

async function main() {
  await checkRLSStatus()
  await checkImportJobs()
  
  console.log('\n✨ RLS check completed!')
}

main().catch(console.error) 