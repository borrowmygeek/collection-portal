import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requirePlatformAdmin } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess } from '@/lib/audit-log'

// Only create client if environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
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
    
    // Fetch all agencies without any status filter
    const { data: allAgencies, error } = await supabase
      .from('master_agencies')
      .select('id, name, code, status, subscription_status, created_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching all agencies:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agencies' },
        { status: 500 }
      )
    }

    // Group agencies by status for easier debugging
    const agenciesByStatus = allAgencies?.reduce((acc, agency) => {
      const status = agency.status || 'unknown';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(agency);
      return acc;
    }, {} as Record<string, any[]>);

    const debugData = {
      total: allAgencies?.length || 0,
      agenciesByStatus,
      allAgencies
    };

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'DEBUG_AGENCIES_VIEW',
      'master_agencies',
      undefined,
      { totalAgencies: debugData.total },
      request
    )

    return NextResponse.json(debugData);

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 