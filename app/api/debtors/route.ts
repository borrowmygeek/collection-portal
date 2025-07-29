import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requireRole } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    const rateLimitResult = await rateLimitByUser(user.id, 100, 15 * 60 * 1000)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to view debt accounts
    if (user.role !== 'platform_admin' && user.role !== 'agency_admin' && user.role !== 'agency_user') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const supabase = createSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    // Build query
    let query = supabase
      .from('debt_accounts')
      .select(`
        *,
        persons!debt_accounts_person_id_fkey(
          id,
          full_name,
          first_name,
          last_name,
          ssn,
          phone_numbers(
            id,
            number,
            phone_type,
            is_current,
            is_verified
          )
        ),
        master_portfolios!debt_accounts_portfolio_id_fkey(
          id,
          name,
          description
        ),
        master_clients!debt_accounts_client_id_fkey(
          id,
          name,
          code
        ),
        platform_users!debt_accounts_assigned_collector_id_fkey(
          id,
          full_name,
          email
        )
      `)

    // Apply filters
    const search = searchParams.get('search')
    const phoneSearch = searchParams.get('phone')
    const portfolioId = searchParams.get('portfolioId')
    const statusFilter = searchParams.get('status')
    const priorityFilter = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,account_number.ilike.%${search}%,original_creditor_name.ilike.%${search}%`)
    }

    if (phoneSearch) {
      // Simple phone search - just look for the phone number in the persons.phone_numbers
      const normalizedPhone = phoneSearch.replace(/\D/g, '')
      query = query.or(`persons.phone_numbers.number.ilike.%${normalizedPhone}%`)
    }

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId)
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (priorityFilter && priorityFilter !== 'all') {
      query = query.eq('collection_priority', priorityFilter)
    }

    // Apply agency filtering for non-platform admins
    if (user.role !== 'platform_admin') {
      query = query.eq('master_portfolios.agency_id', user.agency_id)
    }

    // Get total count for pagination
    const { count } = await query

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: debtAccounts, error, count: actualCount } = await query

    if (error) {
      console.error('Error fetching debt accounts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch debt accounts' },
        { status: 500 }
      )
    }

    // Log data access
    await logDataAccess(
      user.id,
      AUDIT_ACTIONS.DATA_VIEW,
      'debt_accounts',
      undefined,
      {
        search,
        phoneSearch,
        portfolioId,
        statusFilter,
        priorityFilter,
        limit,
        offset
      },
      request
    )

    return NextResponse.json({
      success: true,
      data: {
        count: debtAccounts?.length || 0, 
        total: count || 0,
        debtAccounts: debtAccounts || [],
        pagination: {
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      }
    })

  } catch (error) {
    console.error('Error in debt accounts GET:', error)
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
    const rateLimitResult = await rateLimitByUser(user.id, 50, 5 * 60 * 1000)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to create debt accounts
    if (user.role !== 'platform_admin' && user.role !== 'agency_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to create debt accounts' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const supabase = createSupabaseClient()

    // Add created_by field
    const debtAccountData = {
      ...body,
      created_by: user.id
    }

    // Insert debt account
    const { data: newDebtAccount, error } = await supabase
      .from('debt_accounts')
      .insert(debtAccountData)
      .select()
      .single()

    if (error) {
      console.error('Error creating debt account:', error)
      return NextResponse.json(
        { error: 'Failed to create debt account' },
        { status: 500 }
      )
    }

    // Log data modification
    await logDataModification(
      user.id,
      AUDIT_ACTIONS.DATA_CREATE,
      'debt_accounts',
      newDebtAccount.id,
      {
        account_number: newDebtAccount.account_number,
        original_account_number: newDebtAccount.original_account_number,
        portfolio_id: newDebtAccount.portfolio_id
      },
      request
    )

    return NextResponse.json({
      success: true,
      data: newDebtAccount
    })

  } catch (error) {
    console.error('Error in debt accounts POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 