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

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult
    
    // Get import job details
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
    
    // Check permissions - user can only download their own failed rows or platform admin
    if (user.activeRole.roleType !== 'platform_admin' && job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // Check if failed rows CSV exists
    if (!job.failed_rows_csv_path) {
      return NextResponse.json(
        { error: 'No failed rows CSV available for this import job' },
        { status: 404 }
      )
    }
    
    // Download the CSV file from storage
    const { data: csvData, error: downloadError } = await supabase.storage
      .from('import-files')
      .download(job.failed_rows_csv_path)
    
    if (downloadError || !csvData) {
      console.error('Error downloading failed rows CSV:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download failed rows CSV' },
        { status: 500 }
      )
    }
    
    // Convert to text
    const csvText = await csvData.text()
    
    // Return CSV file
    return new NextResponse(csvText, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="failed_rows_${jobId}.csv"`,
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error: any) {
    console.error('Error in failed rows download:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 