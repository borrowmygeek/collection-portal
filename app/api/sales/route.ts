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

    // Check if user has permission to view sales
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    
    // Get available portfolio sales with basic info first
    const { data: sales, error, count } = await supabase
      .from('portfolio_sales')
      .select(`
        *,
        portfolio:master_portfolios(
          id,
          name,
          description,
          status
        ),
        client:master_clients(
          id,
          name,
          status
        ),
        seller:master_clients!portfolio_sales_seller_id_fkey(
          id,
          name,
          status
        )
      `, { count: 'exact' })
      .eq('sale_status', 'available')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching portfolio sales:', error)
      // Return empty results instead of error
      return NextResponse.json({
        sales: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      })
    }

    // Try to get stats for each sale (optional)
    const salesWithStats = sales?.map(sale => {
      return {
        ...sale,
        stats: null // We'll populate this later when needed
      }
    }) || []

    const result = {
      sales: salesWithStats,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    }

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'SALES_VIEW',
      'portfolio_sales',
      undefined,
      { 
        searchParams: { page, limit },
        resultCount: sales?.length || 0 
      },
      request
    )

    return NextResponse.json(result)

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

    // Check if user has permission to create sales
    const allowedRoles = ['platform_admin', 'agency_admin']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.portfolio_id) {
      return NextResponse.json(
        { error: 'Portfolio ID is required' },
        { status: 400 }
      )
    }

    // Get portfolio details
    const { data: portfolio } = await supabase
      .from('master_portfolios')
      .select('id, client_id, name')
      .eq('id', body.portfolio_id)
      .single()

    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }

    // Create the portfolio sale
    const { data: sale, error } = await supabase
      .from('portfolio_sales')
      .insert({
        portfolio_id: body.portfolio_id,
        client_id: portfolio.client_id,
        seller_id: portfolio.client_id,
        asking_price: body.asking_price,
        minimum_offer: body.minimum_offer,
        sale_notes: body.sale_notes,
        key_highlights: body.key_highlights,
        restrictions: body.restrictions,
        expires_at: body.expires_at,
        created_by: user.id
      })
      .select(`
        *,
        portfolio:master_portfolios(
          id,
          name,
          description,
          status
        ),
        client:master_clients(
          id,
          name,
          status
        ),
        seller:master_clients!portfolio_sales_seller_id_fkey(
          id,
          name,
          status
        )
      `)
      .single()

    if (error) {
      console.error('Error creating portfolio sale:', error)
      return NextResponse.json(
        { error: 'Failed to create portfolio sale' },
        { status: 500 }
      )
    }

    // Log the data modification
    await logDataModification(
      user.auth_user_id,
      'SALES_CREATE',
      'portfolio_sales',
      sale.id,
      {
        portfolio_id: sale.portfolio_id,
        client_id: sale.client_id,
        seller_id: sale.seller_id,
        asking_price: sale.asking_price,
        minimum_offer: sale.minimum_offer,
        sale_notes: sale.sale_notes,
        key_highlights: sale.key_highlights,
        restrictions: sale.restrictions,
        expires_at: sale.expires_at,
      },
      request
    )

    return NextResponse.json(sale, { status: 201 })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 