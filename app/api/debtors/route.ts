import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requireRole } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

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
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 200, 15 * 60 * 1000)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to view debtors
    if (!requireRole(user, ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const portfolioId = searchParams.get('portfolioId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const phoneSearch = searchParams.get('phone') // New phone search parameter
    const offset = (page - 1) * limit

    const supabase = createSupabaseClient()
    
    let query = supabase
      .from('debtors')
      .select(`
        *,
        persons(
          id,
          ssn,
          full_name,
          first_name,
          last_name,
          dob,
          gender,
          occupation,
          employer,
          do_not_call,
          do_not_mail,
          do_not_email,
          do_not_text,
          bankruptcy_filed,
          active_military,
          phone_numbers(
            id,
            number,
            phone_type,
            is_current,
            is_verified
          )
        ),
        master_portfolios(
          id,
          name,
          portfolio_type
        ),
        master_clients(
          id,
          name,
          code
        ),
        platform_users!debtors_assigned_collector_id_fkey(
          id,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by user's agency if not platform admin
    if (user.role !== 'platform_admin') {
      if (user.agency_id) {
        query = query.eq('agency_id', user.agency_id)
      }
    }

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId)
    }

    if (status) {
      query = query.eq('collection_status', status)
    }

    // Search by name, account number, or creditor
    if (search) {
      query = query.or(`
        persons.full_name.ilike.%${search}%,
        persons.first_name.ilike.%${search}%,
        persons.last_name.ilike.%${search}%,
        account_number.ilike.%${search}%,
        original_creditor_name.ilike.%${search}%
      `)
    }

    // Search by phone number
    if (phoneSearch) {
      // Normalize phone number (remove non-digits)
      const normalizedPhone = phoneSearch.replace(/\D/g, '')
      query = query.or(`
        persons.phone_numbers.number.ilike.%${normalizedPhone}%,
        persons.phone_numbers.number.ilike.%${phoneSearch}%
      `)
    }

    const { data: debtors, error, count } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching debtors:', error)
      return NextResponse.json(
        { error: 'Failed to fetch debtors' },
        { status: 500 }
      )
    }

    // Log successful data access
    await logDataAccess(
      user.auth_user_id,
      AUDIT_ACTIONS.DATA_VIEW,
      'debtor',
      undefined,
      { count: debtors?.length || 0, total: count || 0 },
      request
    )

    return NextResponse.json({
      debtors: debtors || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })

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
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 50, 5 * 60 * 1000)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to create debtors
    if (!requireRole(user, ['platform_admin', 'agency_admin', 'client_admin'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create debtors' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    const body = await request.json()
    
    // Validate required fields
    if (!body.portfolio_id || !body.account_number || !body.current_balance) {
      return NextResponse.json(
        { error: 'Portfolio ID, account number, and current balance are required' },
        { status: 400 }
      )
    }

    // Check if user has access to the specified portfolio
    if (user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to create debtors' },
        { status: 403 }
      )
    }

    // Log the attempt
    await logDataAccess(
      user.auth_user_id,
      AUDIT_ACTIONS.DATA_CREATE,
      'debtor',
      undefined,
      { 
        portfolio_id: body.portfolio_id,
        account_number: body.account_number,
        current_balance: body.current_balance
      },
      request
    )

    // Create debtor (simplified - in practice, this would be more complex)
    const { data: debtor, error } = await supabase
      .from('debtors')
      .insert([{
        portfolio_id: body.portfolio_id,
        account_number: body.account_number,
        current_balance: body.current_balance,
        original_balance: body.original_balance || body.current_balance,
        status: body.status || 'active',
        agency_id: user.agency_id || null
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating debtor:', error)
      return NextResponse.json(
        { error: 'Failed to create debtor' },
        { status: 500 }
      )
    }

    // Log successful creation
    await logDataModification(
      user.auth_user_id,
      AUDIT_ACTIONS.DATA_CREATE,
      'debtor',
      debtor.id,
      { debtor_id: debtor.id },
      request
    )

    return NextResponse.json(debtor)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 