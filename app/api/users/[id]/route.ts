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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseClient()
    
    const { data: user, error } = await supabase
      .from('platform_users')
      .select(`
        *,
        agency:master_agencies(
          id,
          name,
          code
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)

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
    const supabase = createSupabaseClient()
    
    const body = await request.json()
    
    // Validate required fields
    if (!body.full_name || !body.role || !body.status) {
      return NextResponse.json(
        { error: 'Full name, role, and status are required' },
        { status: 400 }
      )
    }

    // Get the current user to check if we need to update auth metadata
    const { data: currentUser, error: fetchError } = await supabase
      .from('platform_users')
      .select('auth_user_id, role')
      .eq('id', params.id)
      .single()

    if (fetchError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update platform user record
    const { data: updatedUser, error: updateError } = await supabase
      .from('platform_users')
      .update({
        full_name: body.full_name,
        role: body.role,
        agency_id: body.agency_id || null,
        status: body.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select(`
        *,
        agency:master_agencies(
          id,
          name,
          code
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating platform user:', updateError)
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      )
    }

    // Update auth user metadata if role changed
    if (currentUser.role !== body.role) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        currentUser.auth_user_id,
        {
          user_metadata: {
            role: body.role
          }
        }
      )

      if (authUpdateError) {
        console.error('Error updating auth user metadata:', authUpdateError)
        // Don't fail the entire operation, just log the error
      }
    }

    return NextResponse.json(updatedUser)

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
    const supabase = createSupabaseClient()
    
    // Get the current user to get auth_user_id
    const { data: currentUser, error: fetchError } = await supabase
      .from('platform_users')
      .select('auth_user_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Delete platform user record
    const { error: deleteError } = await supabase
      .from('platform_users')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting platform user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      )
    }

    // Delete auth user
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
      currentUser.auth_user_id
    )

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError)
      // Don't fail the entire operation, just log the error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 