import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requireRole, requireClientAccess } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'

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
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.id, 200, 15 * 60 * 1000)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to view portfolios
    if (!requireRole(user, ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    
    let query = supabase
      .from('master_portfolios')
      .select(`
        *,
        client:master_clients(
          id,
          name,
          code,
          client_type
        )
      `)
      .order('created_at', { ascending: false })

    // Filter by user's client if not platform admin
    if (user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to view portfolios' },
        { status: 403 }
      )
    }

    const { data: portfolios, error } = await query

    if (error) {
      console.error('Error fetching portfolios:', error)
      return NextResponse.json(
        { error: 'Failed to fetch portfolios' },
        { status: 500 }
      )
    }

    // Log successful data access
    await logDataAccess(
      user.id,
      AUDIT_ACTIONS.DATA_VIEW,
      'portfolio',
      undefined,
      { count: portfolios?.length || 0 },
      request
    )

    return NextResponse.json(portfolios)

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
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.id, 20, 5 * 60 * 1000) // 20 requests per 5 minutes
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to create portfolios
    if (!requireRole(user, ['platform_admin', 'client_admin'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create portfolios' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.client_id) {
      return NextResponse.json(
        { error: 'Name and client are required' },
        { status: 400 }
      )
    }

    // Check if user has access to the specified client
    if (user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to create portfolios' },
        { status: 403 }
      )
    }

    // Validate numeric fields - allow 0 values for new portfolios
    if (typeof body.original_balance !== 'number' || typeof body.account_count !== 'number') {
      return NextResponse.json(
        { error: 'Original balance and account count must be numbers' },
        { status: 400 }
      )
    }

    // Check if portfolio name already exists for this client
    const { data: existingPortfolio } = await supabase
      .from('master_portfolios')
      .select('id, name')
      .eq('client_id', body.client_id)
      .eq('name', body.name)
      .single()

    if (existingPortfolio) {
      return NextResponse.json(
        { error: `A portfolio with the name "${body.name}" already exists for this client` },
        { status: 400 }
      )
    }

    // Log the attempt
    await logDataAccess(
      user.id,
      AUDIT_ACTIONS.DATA_CREATE,
      'portfolio',
      undefined,
      { 
        name: body.name,
        client_id: body.client_id,
        portfolio_type: body.portfolio_type || 'credit_card'
      },
      request
    )

    // Create portfolio
    const { data: portfolio, error } = await supabase
      .from('master_portfolios')
      .insert([{
        name: body.name,
        description: body.description || '',
        client_id: body.client_id,
        portfolio_type: body.portfolio_type || 'credit_card',
        original_balance: body.original_balance,
        account_count: body.account_count,
        charge_off_date: body.charge_off_date,
        debt_age_months: body.debt_age_months,
        average_balance: body.average_balance,
        geographic_focus: body.geographic_focus || [],
        credit_score_range: body.credit_score_range || '',
        status: body.status || 'active'
      }])
      .select(`
        *,
        client:master_clients(
          id,
          name,
          code,
          client_type
        )
      `)
      .single()

    if (error) {
      console.error('Error creating portfolio:', error)
      return NextResponse.json(
        { error: 'Failed to create portfolio' },
        { status: 500 }
      )
    }

    // Log successful data modification
    await logDataModification(
      user.id,
      AUDIT_ACTIONS.DATA_CREATE,
      'portfolio',
      portfolio?.id,
      portfolio,
      request
    )

    return NextResponse.json(portfolio)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 