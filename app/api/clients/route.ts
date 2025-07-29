import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requireRole, requirePlatformAdmin } from '@/lib/auth-utils'
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

    // Check if user has permission to view clients
    if (!requireRole(user, ['platform_admin', 'client_admin', 'client_user'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    
    let query = supabase
      .from('master_clients')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by user's client if not platform admin
    if (user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to view clients' },
        { status: 403 }
      )
    }

    const { data: clients, error } = await query

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json(
        { error: 'Failed to fetch clients' },
        { status: 500 }
      )
    }

    // Log successful data access
    await logDataAccess(
      user.auth_user_id,
      AUDIT_ACTIONS.DATA_VIEW,
      'client',
      undefined,
      { count: clients?.length || 0 },
      request
    )

    return NextResponse.json(clients || [])

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
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 20, 5 * 60 * 1000)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user has permission to create clients
    if (!requirePlatformAdmin(user)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create clients' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.code || !body.client_type) {
      return NextResponse.json(
        { error: 'Name, code, and client type are required' },
        { status: 400 }
      )
    }

    // Log the attempt
    await logDataAccess(
      user.auth_user_id,
      AUDIT_ACTIONS.DATA_CREATE,
      'client',
      undefined,
      { 
        name: body.name,
        code: body.code,
        client_type: body.client_type
      },
      request
    )

    // Check if client code already exists
    const { data: existingClient } = await supabase
      .from('master_clients')
      .select('id, code')
      .eq('code', body.code)
      .single()

    if (existingClient) {
      return NextResponse.json(
        { error: `A client with the code "${body.code}" already exists` },
        { status: 400 }
      )
    }

    // Create client
    const { data: client, error } = await supabase
      .from('master_clients')
      .insert([{
        name: body.name,
        code: body.code,
        client_type: body.client_type,
        contact_email: body.contact_email || '',
        contact_phone: body.contact_phone || '',
        address_line1: body.address_line1 || '',
        address_line2: body.address_line2 || '',
        city: body.city || '',
        state: body.state || '',
        zipcode: body.zipcode || '',
        status: body.status || 'active'
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating client:', error)
      return NextResponse.json(
        { error: 'Failed to create client' },
        { status: 500 }
      )
    }

    // Log successful creation
    await logDataModification(
      user.auth_user_id,
      AUDIT_ACTIONS.DATA_CREATE,
      'client',
      client.id,
      { client_id: client.id },
      request
    )

    return NextResponse.json(client)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 