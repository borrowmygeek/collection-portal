import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'

// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    // Get job ID from query parameters
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job_id parameter' },
        { status: 400 }
      )
    }
    
    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to cancel import jobs' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    // Get the import job
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      )
    }
    
    // Check if job is in a cancellable state
    if (job.status !== 'processing' && job.status !== 'pending') {
      return NextResponse.json(
        { error: 'Import job cannot be cancelled in its current state' },
        { status: 400 }
      )
    }
    
    // Update the job status to cancelled
    const { error: updateError } = await supabase
      .from('import_jobs')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    if (updateError) {
      console.error('Error cancelling import job:', updateError)
      return NextResponse.json(
        { error: 'Failed to cancel import job' },
        { status: 500 }
      )
    }
    
    // If the job was processing and had a portfolio, we should clean up any partial data
    if (job.status === 'processing' && job.portfolio_id) {
      // Delete any debt accounts that were created by this import job
      const { error: deleteError } = await supabase
        .from('debt_accounts')
        .delete()
        .eq('import_batch_id', jobId)
      
      if (deleteError) {
        console.error('Error cleaning up debt accounts from cancelled job:', deleteError)
        // Don't fail the entire operation for this
      }
      
      // Check if this was the only import for the portfolio
      const { data: otherJobs, error: checkError } = await supabase
        .from('import_jobs')
        .select('id')
        .eq('portfolio_id', job.portfolio_id)
        .neq('status', 'cancelled')
      
      if (!checkError && (!otherJobs || otherJobs.length === 0)) {
        // This was the only import for the portfolio, delete the portfolio
        const { error: portfolioDeleteError } = await supabase
          .from('master_portfolios')
          .delete()
          .eq('id', job.portfolio_id)
        
        if (portfolioDeleteError) {
          console.error('Error deleting portfolio from cancelled job:', portfolioDeleteError)
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Import job cancelled successfully' 
    })
    
  } catch (error) {
    console.error('Error in cancel import job endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 