import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Only create client if environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseClient()
    
    // Check if user is authenticated and is a platform admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to check role
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is platform admin
    const { data: profile, error: profileError } = await supabase
      .from('platform_users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
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
    const supabase = createSupabaseClient()
    
    // Check if user is authenticated and is a platform admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to check role
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is platform admin
    const { data: profile, error: profileError } = await supabase
      .from('platform_users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    console.log('Deleting client:', params.id)
    
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

    console.log('Client deleted successfully')
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/clients/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 