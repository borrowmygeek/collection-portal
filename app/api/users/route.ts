import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, requirePlatformAdmin } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logUserAction, logSecurityEvent, AUDIT_ACTIONS } from '@/lib/audit-log'

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
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'GET', error: authError },
        false,
        authError || 'Authentication failed',
        request
      )
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 100, 15 * 60 * 1000)
    if (!rateLimitResult.success) {
      await logSecurityEvent(
        user.auth_user_id,
        AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        { endpoint: '/api/users', method: 'GET' },
        false,
        'Rate limit exceeded',
        request
      )
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check permissions - only platform admins can view all users
    if (!requirePlatformAdmin(user)) {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'GET', requiredRole: 'platform_admin' },
        false,
        'Insufficient permissions',
        request
      )
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    
    const { data: users, error } = await supabase
      .from('platform_users')
      .select(`
        *,
        agency:master_agencies(
          id,
          name,
          code
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'GET', error: error.message },
        false,
        'Database error',
        request
      )
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Log successful data access
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.DATA_VIEW,
      'all',
      { count: users?.length || 0 },
      request
    )

    return NextResponse.json(users || [])

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
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', error: authError },
        false,
        authError || 'Authentication failed',
        request
      )
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 10, 5 * 60 * 1000) // 10 requests per 5 minutes
    if (!rateLimitResult.success) {
      await logSecurityEvent(
        user.auth_user_id,
        AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        { endpoint: '/api/users', method: 'POST' },
        false,
        'Rate limit exceeded',
        request
      )
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check if user is platform admin
    if (!requirePlatformAdmin(user)) {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', requiredRole: 'platform_admin' },
        false,
        'Insufficient permissions',
        request
      )
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    const body = await request.json()
    
    // Log the attempt (without sensitive data)
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.USER_CREATE,
      'new',
      { 
        email: body.email,
        role: body.role,
        full_name: body.full_name,
        agency_id: body.agency_id || null
      },
      request
    )

    console.log('Received user creation request:', { ...body, password: '[REDACTED]' })
    
    // Validate required fields
    if (!body.email || !body.full_name || !body.role || !body.password) {
      console.log('Missing required fields:', { email: !!body.email, full_name: !!body.full_name, role: !!body.role, password: !!body.password })
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', missingFields: { email: !!body.email, full_name: !!body.full_name, role: !!body.role, password: !!body.password } },
        false,
        'Missing required fields',
        request
      )
      return NextResponse.json(
        { error: 'Email, full name, role, and password are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    console.log('Checking for existing user with email:', body.email)
    const { data: existingUser, error: checkError } = await supabase
      .from('platform_users')
      .select('id')
      .eq('email', body.email)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', error: checkError.message },
        false,
        'Failed to check existing user',
        request
      )
      return NextResponse.json(
        { error: 'Failed to check existing user' },
        { status: 500 }
      )
    }

    if (existingUser) {
      console.log('User already exists:', existingUser)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', existingUser: existingUser },
        false,
        'User already exists',
        request
      )
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Create auth user first
    console.log('Creating auth user...')
    const { data: authUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: body.role
      }
    })

    if (createAuthError) {
      console.error('Error creating auth user:', createAuthError)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', error: createAuthError.message },
        false,
        'Failed to create auth user',
        request
      )
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    console.log('Auth user created successfully:', authUser.user.id)

    // Wait for trigger to create platform user
    console.log('Waiting for trigger to create platform user...')
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second

    // Fetch the platform user created by trigger
    console.log('Fetching platform user created by trigger...')
    const { data: platformUser, error: platformError } = await supabase
      .from('platform_users')
      .select(`
        *,
        agency:master_agencies(
          id,
          name,
          code
        )
      `)
      .eq('auth_user_id', authUser.user.id)
      .single()

    if (platformError) {
      console.error('Error fetching platform user created by trigger:', platformError)
      // Clean up auth user if platform user wasn't created
      await supabase.auth.admin.deleteUser(authUser.user.id)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', error: platformError.message },
        false,
        'Failed to create user profile - trigger may have failed',
        request
      )
      return NextResponse.json(
        { error: 'Failed to create user profile - trigger may have failed' },
        { status: 500 }
      )
    }

    console.log('Platform user created by trigger successfully:', platformUser)
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.USER_CREATE,
      'success',
      { 
        email: platformUser.email,
        role: platformUser.role,
        full_name: platformUser.full_name,
        agency_id: platformUser.agency_id || null
      },
      request
    )
    return NextResponse.json(platformUser, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in POST /api/users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 