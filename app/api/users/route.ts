import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [USERS API] GET /api/users - Starting request')
    
    const supabase = createAdminSupabaseClient()
    
    // Get the authenticated user from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [USERS API] No valid authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('❌ [USERS API] Auth error:', authError)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('✅ [USERS API] User authenticated:', user.id)

    // Check if user is platform admin using our new function
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_platform_admin', {
      user_id: user.id
    })

    if (adminCheckError) {
      console.error('❌ [USERS API] Admin check error:', adminCheckError)
      return NextResponse.json({ error: 'Permission check failed' }, { status: 500 })
    }

    console.log('🔍 [USERS API] Platform admin check result:', isAdmin)

    if (!isAdmin) {
      console.log('❌ [USERS API] User is not platform admin, access denied')
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    console.log('✅ [USERS API] User is platform admin, proceeding with user list')

    // Fetch users with their roles from the new multi-role system
    // Since we're using admin client, we can bypass RLS for this query
    const { data: users, error } = await supabase
      .from('platform_users')
      .select(`
        *,
        user_roles(
          id,
          role_type,
          organization_type,
          organization_id,
          is_active,
          is_primary,
          permissions,
          created_at
        ),
        agency:master_agencies(
          id,
          name,
          code
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [USERS API] Database query error:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    console.log('✅ [USERS API] Successfully fetched users:', users?.length || 0)

    // Transform the data to match the expected format
    const transformedUsers = users?.map((user: any) => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles: user.user_roles || [],
      agency: user.agency
    })) || []

    return NextResponse.json({
      users: transformedUsers,
      total: transformedUsers.length
    })

  } catch (error) {
    console.error('❌ [USERS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [USERS API] POST /api/users - Starting request')
    
    const supabase = createAdminSupabaseClient()
    
    // Get the authenticated user from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [USERS API] No valid authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('❌ [USERS API] Auth error:', authError)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('✅ [USERS API] User authenticated:', user.id)

    // Check if user is platform admin using our new function
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_platform_admin', {
      user_id: user.id
    })

    if (adminCheckError) {
      console.error('❌ [USERS API] Admin check error:', adminCheckError)
      return NextResponse.json({ error: 'Permission check failed' }, { status: 500 })
    }

    if (!isAdmin) {
      console.log('❌ [USERS API] User is not platform admin, access denied')
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { email, full_name, role_type, organization_type, organization_id } = body

    if (!email || !full_name || !role_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('✅ [USERS API] Creating new user with role:', { email, role_type, organization_type })

    // Create the user profile
    const { data: newUser, error: userError } = await supabase
      .from('platform_users')
      .insert({
        email,
        full_name,
        status: 'active'
      })
      .select()
      .single()

    if (userError) {
      console.error('❌ [USERS API] User creation error:', userError)
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Create the user role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUser.id,
        role_type,
        organization_type: organization_type || 'platform',
        organization_id: organization_id || null,
        is_active: true,
        is_primary: true,
        permissions: {}
      })

    if (roleError) {
      console.error('❌ [USERS API] Role creation error:', roleError)
      // Clean up the user if role creation fails
      await supabase.from('platform_users').delete().eq('id', newUser.id)
      return NextResponse.json({ error: 'Failed to create user role' }, { status: 500 })
    }

    console.log('✅ [USERS API] User created successfully:', newUser.id)

    return NextResponse.json({
      message: 'User created successfully',
      user: newUser
    })

  } catch (error) {
    console.error('❌ [USERS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 