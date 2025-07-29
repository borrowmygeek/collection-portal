const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkImportStatus() {
  try {
    console.log('Checking import job status...\n')
    
    // Get all import jobs
    const { data: jobs, error } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('Error fetching import jobs:', error)
      return
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('No import jobs found')
      return
    }
    
    console.log('Recent Import Jobs:')
    console.log('==================')
    
    jobs.forEach((job, index) => {
      console.log(`\n${index + 1}. Job ID: ${job.id}`)
      console.log(`   File: ${job.file_name}`)
      console.log(`   Type: ${job.import_type}`)
      console.log(`   Status: ${job.status}`)
      console.log(`   Progress: ${job.progress}%`)
      console.log(`   Total Rows: ${job.total_rows}`)
      console.log(`   Successful: ${job.successful_rows || 0}`)
      console.log(`   Failed: ${job.failed_rows || 0}`)
      console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`)
      console.log(`   Updated: ${new Date(job.updated_at).toLocaleString()}`)
      
      if (job.errors) {
        console.log(`   Errors: ${JSON.stringify(job.errors, null, 2)}`)
      }
    })
    
    // Check for stuck jobs (processing for more than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const stuckJobs = jobs.filter(job => 
      job.status === 'processing' && 
      new Date(job.updated_at) < thirtyMinutesAgo
    )
    
    if (stuckJobs.length > 0) {
      console.log('\n⚠️  STUCK JOBS DETECTED:')
      console.log('======================')
      stuckJobs.forEach(job => {
        console.log(`- Job ${job.id} (${job.file_name}) has been processing since ${new Date(job.updated_at).toLocaleString()}`)
      })
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

checkImportStatus() 