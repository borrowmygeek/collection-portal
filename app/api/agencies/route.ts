import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 200, 15 * 60 * 1000)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to view agencies
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    let query = supabase
      .from('master_agencies')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by user's agency if not platform admin
    if (user.activeRole.roleType !== 'platform_admin' && user.activeRole.organizationId) {
      query = query.eq('id', user.activeRole.organizationId)
    }

    const { data: agencies, error } = await query

    if (error) {
      console.error('Error fetching agencies:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agencies' },
        { status: 500 }
      )
    }

    // Log successful data access
    await logDataAccess(
      user.auth_user_id,
      AUDIT_ACTIONS.DATA_VIEW,
      'agency',
      undefined,
      { count: agencies?.length || 0 },
      request
    )

    return NextResponse.json(agencies || [])

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 