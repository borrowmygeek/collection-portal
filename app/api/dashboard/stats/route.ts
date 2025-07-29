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

    // Check if user has permission to view dashboard stats
    if (!requirePlatformAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createSupabaseClient()
    
    // Get total agencies
    const { count: totalAgencies } = await supabase
      .from('master_agencies')
      .select('*', { count: 'exact', head: true })

    // Get active users (platform_users with active status)
    const { count: activeUsers } = await supabase
      .from('platform_users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Calculate monthly revenue from agency billing
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const { data: billingData } = await supabase
      .from('agency_billing')
      .select('total_amount')
      .eq('billing_period', currentMonth)
      .eq('status', 'paid')

    const monthlyRevenue = billingData?.reduce((sum, record) => sum + (record.total_amount || 0), 0) || 0

    // Platform health (simplified - could be more sophisticated)
    const platformHealth = 100 // Default to 100% - could calculate based on uptime, errors, etc.

    const stats = {
      totalAgencies: totalAgencies || 0,
      activeUsers: activeUsers || 0,
      monthlyRevenue,
      platformHealth
    }

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'DASHBOARD_STATS_VIEW',
      'dashboard_stats',
      undefined,
      { stats },
      request
    )

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard statistics',
        totalAgencies: 0,
        activeUsers: 0,
        monthlyRevenue: 0,
        platformHealth: 100
      },
      { status: 500 }
    )
  }
} 