const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixStuckImport() {
  try {
    console.log('Fixing stuck import job...\n')
    
    // Get the stuck job
    const { data: jobs, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('status', 'processing')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Error fetching import jobs:', error)
      return
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('No stuck import jobs found')
      return
    }
    
    const job = jobs[0]
    console.log(`Found stuck job: ${job.id}`)
    console.log(`File: ${job.file_name}`)
    console.log(`Progress: ${job.progress}%`)
    console.log(`Successful: ${job.successful_rows || 0}`)
    console.log(`Failed: ${job.failed_rows || 0}`)
    console.log(`Total: ${job.total_rows}`)
    
    // Calculate the final status
    const failedCount = job.failed_rows || 0
    const successfulCount = job.successful_rows || 0
    const totalCount = job.total_rows || 0
    
    // If we have processed all rows, mark as completed
    if (successfulCount + failedCount >= totalCount) {
      const finalStatus = failedCount === 0 ? 'completed' : 'completed_with_errors'
      
      console.log(`\nUpdating job status to: ${finalStatus}`)
      
      const { error: updateError } = await supabase
        .from('import_jobs')
        .update({ 
          status: finalStatus, 
          progress: 100,
          successful_rows: successfulCount,
          failed_rows: failedCount
        })
        .eq('id', job.id)
      
      if (updateError) {
        console.error('Error updating job:', updateError)
        return
      }
      
      console.log('✅ Job status updated successfully!')
    } else {
      console.log('\n⚠️  Job appears to be genuinely stuck - not all rows processed')
      console.log(`Processed: ${successfulCount + failedCount}/${totalCount}`)
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

fixStuckImport() 