import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess } from '@/lib/audit-log'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 30, 60000) // 30 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' }
        }
      )
    }

    // Check if user has permission to view security data
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action')
    const resourceType = searchParams.get('resourceType')
    const success = searchParams.get('success')
    const dateRange = searchParams.get('dateRange') || '24h'
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (action) {
      query = query.eq('action', action)
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }
    if (success !== null && success !== undefined) {
      query = query.eq('success', success === 'true')
    }
    if (dateRange) {
      const now = new Date()
      let startDate = new Date()
      switch (dateRange) {
        case '1h':
          startDate.setHours(now.getHours() - 1)
          break
        case '24h':
          startDate.setDate(now.getDate() - 1)
          break
        case '7d':
          startDate.setDate(now.getDate() - 7)
          break
        case '30d':
          startDate.setDate(now.getDate() - 30)
          break
      }
      query = query.gte('created_at', startDate.toISOString())
    }

    const { data: auditLogs, error, count } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'SECURITY_AUDIT_LOGS_VIEW',
      'audit_logs',
      undefined,
      { 
        searchParams: { page, limit, action, resourceType, success, dateRange },
        resultCount: auditLogs?.length || 0 
      },
      request
    )

    return NextResponse.json({
      auditLogs: auditLogs || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })

  } catch (error) {
    console.error('Error in security audit logs API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 