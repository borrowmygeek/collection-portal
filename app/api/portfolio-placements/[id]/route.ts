import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to view portfolio placements
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view portfolio placements' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    const { data: placement, error } = await supabase
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
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching portfolio placement:', error)
      return NextResponse.json(
        { error: 'Portfolio placement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(placement)

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
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to update portfolio placements
    const allowedRoles = ['platform_admin', 'agency_admin']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update portfolio placements' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    const body = await request.json()
    
    // Validate required fields
    if (!body.placement_amount || !body.account_count || 
        !body.contingency_rate || !body.min_settlement_rate) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Update portfolio placement
    const { data: placement, error } = await supabase
      .from('master_portfolio_placements')
      .update({
        placement_amount: body.placement_amount,
        account_count: body.account_count,
        contingency_rate: body.contingency_rate,
        flat_fee_rate: body.flat_fee_rate,
        min_settlement_rate: body.min_settlement_rate,
        status: body.status,
        return_date: body.return_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
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
      console.error('Error updating portfolio placement:', error)
      return NextResponse.json(
        { error: 'Failed to update portfolio placement' },
        { status: 500 }
      )
    }

    return NextResponse.json(placement)

  } catch (error) {
    console.error('Error:', error)
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
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to delete portfolio placements
    const allowedRoles = ['platform_admin', 'agency_admin']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete portfolio placements' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    // Delete portfolio placement
    const { error } = await supabase
      .from('master_portfolio_placements')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting portfolio placement:', error)
      return NextResponse.json(
        { error: 'Failed to delete portfolio placement' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Portfolio placement deleted successfully' })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 