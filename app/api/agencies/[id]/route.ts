import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'

// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: agency, error } = await supabase
      .from('master_agencies')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching agency:', error)
      return NextResponse.json(
        { error: 'Agency not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(agency)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only platform admins can update agencies.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('Updating agency:', params.id, body)
    
    // Validate required fields
    if (!body.name || !body.code || !body.contact_email) {
      return NextResponse.json(
        { error: 'Name, code, and contact email are required' },
        { status: 400 }
      )
    }

    // Update the agency
    const { data, error } = await supabase
      .from('master_agencies')
      .update({
        name: body.name,
        code: body.code,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        address: body.address,
        city: body.city,
        state: body.state,
        zipcode: body.zipcode,
        subscription_tier: body.subscription_tier,
        subscription_status: body.subscription_status,
        subscription_start_date: body.subscription_start_date,
        subscription_end_date: body.subscription_end_date,
        billing_cycle: body.billing_cycle,
        base_monthly_fee: body.base_monthly_fee,
        max_users: body.max_users,
        max_portfolios: body.max_portfolios,
        max_debt_accounts: body.max_debt_accounts,
        storage_limit_gb: body.storage_limit_gb,
        status: body.status,
        notes: body.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating agency:', error)
      return NextResponse.json(
        { error: 'Failed to update agency' },
        { status: 500 }
      )
    }

    console.log('Agency updated successfully:', data)
    return NextResponse.json(data)

  } catch (error) {
    console.error('Unexpected error in PUT /api/agencies/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only platform admins can delete agencies.' },
        { status: 403 }
      )
    }

    // Check if agency has any clients
    const { data: clients, error: clientError } = await supabase
      .from('master_clients')
      .select('id')
      .eq('agency_id', params.id)
      .limit(1)

    if (clientError) {
      console.error('Error checking clients:', clientError)
      return NextResponse.json(
        { error: 'Failed to check agency clients' },
        { status: 500 }
      )
    }

    if (clients && clients.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete agency with existing clients. Please delete all clients first.' },
        { status: 400 }
      )
    }

    // Delete the agency
    const { error } = await supabase
      .from('master_agencies')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting agency:', error)
      return NextResponse.json(
        { error: 'Failed to delete agency' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Agency deleted successfully' 
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 