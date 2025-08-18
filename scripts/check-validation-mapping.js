require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkValidationMapping() {
  try {
    console.log('🔍 Checking validation field mapping...')
    
    // Get the latest import job
    const { data: jobs, error: jobsError } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (jobsError) {
      console.log('❌ Error fetching jobs:', jobsError.message)
      return
    }
    
    if (jobs.length === 0) {
      console.log('📋 No import jobs found')
      return
    }
    
    const latestJob = jobs[0]
    console.log(`📋 Latest job: ${latestJob.file_name}`)
    console.log(`📊 Import type: ${latestJob.import_type}`)
    
    // Get staging data for this job
    const { data: stagingData, error: stagingError } = await supabase
      .from('import_staging_data')
      .select('*')
      .eq('job_id', latestJob.id)
      .limit(5) // Just get a few rows to analyze
    
    if (stagingError) {
      console.log('❌ Error fetching staging data:', stagingError.message)
      return
    }
    
    console.log(`📊 Found ${stagingData?.length || 0} staging rows to analyze`)
    
    if (stagingData && stagingData.length > 0) {
      // Analyze the first row to understand the structure
      const firstRow = stagingData[0]
      console.log('\n🔍 Analyzing first row structure:')
      console.log(`📊 Row number: ${firstRow.row_number}`)
      console.log(`📊 Table name: ${firstRow.table_name}`)
      
      // Check field mapping
      if (firstRow.field_mapping) {
        console.log('\n📋 Field Mapping:')
        console.log(JSON.stringify(firstRow.field_mapping, null, 2))
      }
      
      // Check mapped data
      if (firstRow.mapped_data) {
        console.log('\n📊 Mapped Data (what validation sees):')
        console.log(JSON.stringify(firstRow.mapped_data, null, 2))
      }
      
      // Check raw data
      if (firstRow.raw_data) {
        console.log('\n📄 Raw Data (original Excel data):')
        console.log(JSON.stringify(firstRow.raw_data, null, 2))
      }
      
      // Check what fields are actually available
      if (firstRow.mapped_data) {
        console.log('\n🔍 Available fields for validation:')
        const availableFields = Object.keys(firstRow.mapped_data)
        availableFields.forEach(field => {
          const value = firstRow.mapped_data[field]
          console.log(`  ${field}: "${value}" (${typeof value})`)
        })
      }
      
      // Check what fields validation is looking for
      console.log('\n🎯 Validation is looking for these fields:')
      const requiredFields = ['ssn', 'first_name', 'last_name']
      const optionalFields = ['current_balance', 'account_number', 'phone_primary', 'email_primary', 'date_opened', 'charge_off_date']
      
      requiredFields.forEach(field => {
        const hasField = firstRow.mapped_data && firstRow.mapped_data[field] !== undefined
        console.log(`  ${field}: ${hasField ? '✅' : '❌'} ${hasField ? `"${firstRow.mapped_data[field]}"` : 'Missing'}`)
      })
      
      optionalFields.forEach(field => {
        const hasField = firstRow.mapped_data && firstRow.mapped_data[field] !== undefined
        console.log(`  ${field}: ${hasField ? '✅' : '⚠️'} ${hasField ? `"${value}"` : 'Missing'}`)
      })
    }
    
  } catch (error) {
    console.error('Script error:', error)
  }
}

checkValidationMapping() 