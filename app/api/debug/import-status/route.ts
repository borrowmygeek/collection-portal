import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requirePlatformAdmin } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess } from '@/lib/audit-log'

const createSupabaseClient = () => {
  const supabaseUrl = 'https://nczrnzqbthaqnrcupneu.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 10, 60000) // 10 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' }
        }
      )
    }

    // Check if user has permission to access debug data
    if (!requirePlatformAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createSupabaseClient()
    
    // Get recent import jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (jobsError) {
      return NextResponse.json({ error: 'Failed to fetch import jobs', details: jobsError }, { status: 500 })
    }

    // Test a simple insert to see if RLS is blocking
    const testData = {
      account_number: 'DEBUG-TEST-001',
      original_balance: 1000.00,
      current_balance: 1000.00,
      portfolio_id: '00000000-0000-0000-0000-000000000000',
      client_id: '00000000-0000-0000-0000-000000000000',
      created_by: '00000000-0000-0000-0000-000000000000',
      status: 'new',
      collection_status: 'new',
      collection_priority: 'normal',
      account_status: 'active'
    }

    const { data: insertResult, error: insertError } = await supabase
      .from('debtors')
      .insert(testData)
      .select()

    const debugData = {
      import_jobs: jobs,
      rls_test: {
        insert_successful: !insertError,
        insert_error: insertError,
        insert_result: insertResult
      }
    };

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'DEBUG_IMPORT_STATUS_VIEW',
      'import_jobs',
      undefined,
      { jobCount: jobs?.length || 0, rlsTestResult: !insertError },
      request
    )

    return NextResponse.json(debugData)

  } catch (error: any) {
    return NextResponse.json({ error: 'Debug failed', details: error.message }, { status: 500 })
  }
} 