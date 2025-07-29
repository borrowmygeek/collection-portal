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
        max_debtors: body.max_debtors,
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

    console.log('Deleting agency:', params.id)
    
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

    console.log('Agency deleted successfully')
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/agencies/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 