import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: client, error } = await supabase
      .from('master_clients')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching client:', error)
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(client)

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
        { error: 'Insufficient permissions. Only platform admins can update clients.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('Updating client:', params.id, body)
    
    // Validate required fields
    if (!body.name || !body.code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Update the client
    const { data, error } = await supabase
      .from('master_clients')
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
        client_type: body.client_type,
        industry: body.industry,
        website: body.website,
        tax_id: body.tax_id,
        dba_name: body.dba_name,
        fdpa_license_number: body.fdpa_license_number,
        compliance_contact_name: body.compliance_contact_name,
        compliance_contact_email: body.compliance_contact_email,
        compliance_contact_phone: body.compliance_contact_phone,
        status: body.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating client:', error)
      return NextResponse.json(
        { error: 'Failed to update client' },
        { status: 500 }
      )
    }

    console.log('Client updated successfully:', data)
    return NextResponse.json(data)

  } catch (error) {
    console.error('Unexpected error in PUT /api/clients/[id]:', error)
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
        { error: 'Insufficient permissions. Only platform admins can delete clients.' },
        { status: 403 }
      )
    }

    // Check if client has any portfolios
    const { data: portfolios, error: portfolioError } = await supabase
      .from('master_portfolios')
      .select('id')
      .eq('client_id', params.id)
      .limit(1)

    if (portfolioError) {
      console.error('Error checking portfolios:', portfolioError)
      return NextResponse.json(
        { error: 'Failed to check client portfolios' },
        { status: 500 }
      )
    }

    if (portfolios && portfolios.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete client with existing portfolios. Please delete all portfolios first.' },
        { status: 400 }
      )
    }

    // Delete the client
    const { error } = await supabase
      .from('master_clients')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting client:', error)
      return NextResponse.json(
        { error: 'Failed to delete client' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Client deleted successfully' 
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 