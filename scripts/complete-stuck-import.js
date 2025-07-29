const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function completeStuckImport() {
  try {
    console.log('Completing stuck import job...\n')
    
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
    
    const processedCount = (job.successful_rows || 0) + (job.failed_rows || 0)
    const remainingCount = job.total_rows - processedCount
    
    console.log(`\nProcessed: ${processedCount}/${job.total_rows}`)
    console.log(`Remaining: ${remainingCount} rows`)
    
    if (remainingCount <= 0) {
      console.log('No remaining rows to process. Marking as completed.')
      
      const finalStatus = (job.failed_rows || 0) === 0 ? 'completed' : 'completed_with_errors'
      
      const { error: updateError } = await supabase
        .from('import_jobs')
        .update({ 
          status: finalStatus, 
          progress: 100
        })
        .eq('id', job.id)
      
      if (updateError) {
        console.error('Error updating job:', updateError)
        return
      }
      
      console.log('✅ Job marked as completed!')
      return
    }
    
    // For now, let's just mark it as completed since we can't easily reprocess
    // the remaining rows without the original file and field mapping
    console.log('\n⚠️  Cannot easily reprocess remaining rows without original file.')
    console.log('Marking job as completed...')
    
    const { error: updateError } = await supabase
      .from('import_jobs')
      .update({ 
        status: 'completed', 
        progress: 100,
        errors: [
          {
            message: `Import stopped early. Processed ${processedCount}/${job.total_rows} rows. ${remainingCount} rows were not processed due to processing error.`,
            severity: 'warning'
          }
        ]
      })
      .eq('id', job.id)
    
    if (updateError) {
      console.error('Error updating job:', updateError)
      return
    }
    
    console.log('✅ Job marked as completed!')
    console.log(`📊 Final Results:`)
    console.log(`   - Successful: ${job.successful_rows || 0}`)
    console.log(`   - Failed: ${job.failed_rows || 0}`)
    console.log(`   - Not Processed: ${remainingCount}`)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

completeStuckImport() 