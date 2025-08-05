import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess } from '@/lib/audit-log'

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
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 20, 60000) // 20 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' }
        }
      )
    }

    // Check if user has permission to view security stats
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    
    // Get date ranges
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get total events in last 24 hours
    const { count: totalEvents24h } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h.toISOString())

    // Get failed events in last 24 hours
    const { count: failedEvents24h } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h.toISOString())
      .eq('success', false)

    // Get unique users in last 24 hours
    const { data: uniqueUsers24h } = await supabase
      .from('audit_logs')
      .select('user_id')
      .gte('created_at', last24h.toISOString())
      .not('user_id', 'is', null)

    // Get unique IPs in last 24 hours
    const { data: uniqueIPs24h } = await supabase
      .from('audit_logs')
      .select('ip_address')
      .gte('created_at', last24h.toISOString())
      .not('ip_address', 'is', null)

    // Get recent activity (last hour)
    const { count: recentActivity1h } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastHour.toISOString())

    // Get events by action type in last 24 hours
    const { data: eventsByAction } = await supabase
      .from('audit_logs')
      .select('action, success')
      .gte('created_at', last24h.toISOString())

    // Get events by resource type in last 24 hours
    const { data: eventsByResource } = await supabase
      .from('audit_logs')
      .select('resource_type')
      .gte('created_at', last24h.toISOString())

    // Get failed login attempts in last 24 hours
    const { count: failedLogins24h } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h.toISOString())
      .eq('action', 'LOGIN_FAILED')

    // Get successful logins in last 24 hours
    const { count: successfulLogins24h } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h.toISOString())
      .eq('action', 'LOGIN_SUCCESS')

    // Get security violations in last 24 hours
    const { count: securityViolations24h } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h.toISOString())
      .eq('action', 'SECURITY_VIOLATION')

    // Calculate unique counts
    const uniqueUsersCount = uniqueUsers24h ? new Set(uniqueUsers24h.map(u => u.user_id)).size : 0
    const uniqueIPsCount = uniqueIPs24h ? new Set(uniqueIPs24h.map(ip => ip.ip_address)).size : 0

    // Process action breakdown
    const actionBreakdown = eventsByAction?.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Process resource breakdown
    const resourceBreakdown = eventsByResource?.reduce((acc, event) => {
      acc[event.resource_type] = (acc[event.resource_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const stats = {
      // 24-hour statistics
      totalEvents24h: totalEvents24h || 0,
      failedEvents24h: failedEvents24h || 0,
      uniqueUsers24h: uniqueUsersCount,
      uniqueIPs24h: uniqueIPsCount,
      recentActivity1h: recentActivity1h || 0,
      
      // Login statistics
      failedLogins24h: failedLogins24h || 0,
      successfulLogins24h: successfulLogins24h || 0,
      securityViolations24h: securityViolations24h || 0,
      
      // Breakdowns
      actionBreakdown,
      resourceBreakdown,
      
      // Success rate
      successRate24h: totalEvents24h ? ((totalEvents24h - (failedEvents24h || 0)) / totalEvents24h * 100).toFixed(1) : '100.0'
    }

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'SECURITY_STATS_VIEW',
      'audit_logs',
      undefined,
      { stats },
      request
    )

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error in security stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 