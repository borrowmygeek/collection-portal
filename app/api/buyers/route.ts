import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requirePlatformAdmin } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification } from '@/lib/audit-log'

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

    // Check if user has permission to view buyers
    if (!requirePlatformAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const offset = (page - 1) * limit

    let query = supabase
      .from('master_buyers')
      .select('*', { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: buyers, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching buyers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch buyers' },
        { status: 500 }
      )
    }

    const result = {
      buyers: buyers || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    }

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'BUYERS_VIEW',
      'master_buyers',
      undefined,
      { 
        searchParams: { page, limit, status },
        resultCount: buyers?.length || 0 
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

    // Check if user has permission to create buyers
    if (!requirePlatformAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.company_name || !body.contact_name || !body.contact_email) {
      return NextResponse.json(
        { error: 'Company name, contact name, and contact email are required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const { data: existingBuyer } = await supabase
      .from('master_buyers')
      .select('id')
      .eq('contact_email', body.contact_email)
      .single()

    if (existingBuyer) {
      return NextResponse.json(
        { error: 'A buyer with this email already exists' },
        { status: 400 }
      )
    }

    // Create the buyer record
    const { data: buyer, error } = await supabase
      .from('master_buyers')
      .insert({
        user_id: user.id,
        company_name: body.company_name,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        website: body.website,
        address_line1: body.address_line1,
        address_line2: body.address_line2,
        city: body.city,
        state: body.state,
        zip_code: body.zip_code,
        country: body.country || 'USA',
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating buyer:', error)
      return NextResponse.json(
        { error: 'Failed to create buyer' },
        { status: 500 }
      )
    }

    // Log the data modification
    await logDataModification(
      user.auth_user_id,
      'BUYERS_CREATE',
      'master_buyers',
      buyer.id,
      {
        companyName: body.company_name,
        contactName: body.contact_name,
        contactEmail: body.contact_email,
        contactPhone: body.contact_phone,
        website: body.website,
        addressLine1: body.address_line1,
        addressLine2: body.address_line2,
        city: body.city,
        state: body.state,
        zipCode: body.zip_code,
        country: body.country || 'USA',
        status: 'pending'
      },
      request
    )

    return NextResponse.json(buyer, { status: 201 })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 