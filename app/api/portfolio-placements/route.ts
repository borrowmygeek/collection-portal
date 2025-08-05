import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification } from '@/lib/audit-log'

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

    // Check if user has permission to view portfolio placements
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const portfolioId = searchParams.get('portfolio_id')

    let query = supabase
      .from('master_portfolio_placements')
      .select(`
        *,
        agency:master_agencies(
          id,
          name,
          code,
          status
        )
      `)
      .order('created_at', { ascending: false })

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId)
    }

    const { data: placements, error } = await query

    if (error) {
      console.error('Error fetching portfolio placements:', error)
      return NextResponse.json(
        { error: 'Failed to fetch portfolio placements' },
        { status: 500 }
      )
    }

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'PORTFOLIO_PLACEMENTS_VIEW',
      'master_portfolio_placements',
      undefined,
      { 
        searchParams: { portfolioId },
        resultCount: placements?.length || 0 
      },
      request
    )

    return NextResponse.json(placements)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Check if user has permission to create portfolio placements
    const allowedRoles = ['platform_admin', 'agency_admin']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    
    const body = await request.json()
    
    // Validate required fields
    if (!body.portfolio_id || !body.agency_id || !body.client_id || 
        !body.placement_amount || !body.account_count || 
        !body.contingency_rate || !body.min_settlement_rate) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Create portfolio placement
    const { data: placement, error } = await supabase
      .from('master_portfolio_placements')
      .insert([{
        portfolio_id: body.portfolio_id,
        agency_id: body.agency_id,
        client_id: body.client_id,
        placement_amount: body.placement_amount,
        placement_date: body.placement_date || new Date().toISOString(),
        account_count: body.account_count,
        contingency_rate: body.contingency_rate,
        flat_fee_rate: body.flat_fee_rate,
        min_settlement_rate: body.min_settlement_rate,
        status: body.status || 'active'
      }])
      .select(`
        *,
        agency:master_agencies(
          id,
          name,
          code,
          status
        )
      `)
      .single()

    if (error) {
      console.error('Error creating portfolio placement:', error)
      return NextResponse.json(
        { error: 'Failed to create portfolio placement' },
        { status: 500 }
      )
    }

    // Log the data modification
    await logDataModification(
      user.auth_user_id,
      'PORTFOLIO_PLACEMENT_CREATE',
      'master_portfolio_placements',
      placement.id,
      placement,
      request
    )

    return NextResponse.json(placement)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 