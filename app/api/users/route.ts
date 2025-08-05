import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, logSecurityEvent, logUserAction, AUDIT_ACTIONS } from '@/lib/audit-log'
import { validateInput, createUserSchema, sanitizeObject, commonSanitizers, containsSqlInjection } from '@/lib/validation'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
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
    if (user.activeRole.roleType !== 'platform_admin') {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'GET', requiredRole: 'platform_admin', userRole: user.activeRole.roleType },
        false,
        'Insufficient permissions',
        request
      )
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    // Fetch users with their roles from the new multi-role system
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

    // Transform the data to include primary role and all roles
    const transformedUsers = users?.map(user => {
      const primaryRole = user.user_roles?.find((role: any) => role.is_primary)
      const activeRoles = user.user_roles?.filter((role: any) => role.is_active) || []
      
      return {
        ...user,
        primary_role: primaryRole ? {
          id: primaryRole.id,
          role_type: primaryRole.role_type,
          organization_type: primaryRole.organization_type,
          organization_id: primaryRole.organization_id,
          permissions: primaryRole.permissions
        } : null,
        roles: activeRoles.map((role: any) => ({
          id: role.id,
          role_type: role.role_type,
          organization_type: role.organization_type,
          organization_id: role.organization_id,
          is_primary: role.is_primary,
          permissions: role.permissions,
          created_at: role.created_at
        })),
        // For backward compatibility, include the old role field
        role: primaryRole?.role_type || 'platform_user'
      }
    }) || []

    // Log successful data access
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.DATA_VIEW,
      'all',
      { count: transformedUsers.length },
      request
    )

    return NextResponse.json(transformedUsers)

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
    if (user.activeRole.roleType !== 'platform_admin') {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', requiredRole: 'platform_admin', userRole: user.activeRole.roleType },
        false,
        'Insufficient permissions',
        request
      )
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    
    // Input validation and sanitization
    const validationResult = await validateInput(createUserSchema, body)
    if (!validationResult.success) {
      console.log('Validation failed:', validationResult.errors)
      console.log('Request body:', JSON.stringify(body, null, 2))
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', validationErrors: validationResult.errors },
        false,
        'Input validation failed',
        request
      )
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.errors },
        { status: 400 }
      )
    }

    // Sanitize the validated data
    const sanitizedData = sanitizeObject(validationResult.data, {
      email: commonSanitizers.email,
      full_name: commonSanitizers.name,
      password: (pwd: string) => pwd, // Don't sanitize passwords
      roles: (roles: any[]) => roles.map((role: any) => ({
        ...role,
        organization_id: role.organization_id === '' ? null : role.organization_id
      })) // Convert empty strings to null for organization_id
    })

    // Additional security checks
    if (containsSqlInjection(sanitizedData.email) || containsSqlInjection(sanitizedData.full_name)) {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', suspiciousInput: true },
        false,
        'Potential SQL injection attempt',
        request
      )
      return NextResponse.json(
        { error: 'Invalid input detected' },
        { status: 400 }
      )
    }

    // Validate roles structure
    const primaryRoles = sanitizedData.roles.filter((role: any) => role.is_primary)
    if (primaryRoles.length === 0) {
      return NextResponse.json(
        { error: 'At least one role must be set as primary' },
        { status: 400 }
      )
    }

    if (primaryRoles.length > 1) {
      return NextResponse.json(
        { error: 'Only one role can be set as primary' },
        { status: 400 }
      )
    }

    // Validate that organization-specific roles have organization_id
    const invalidRoles = sanitizedData.roles.filter((role: any) => 
      role.organization_type !== 'platform' && !role.organization_id
    )
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: 'Organization-specific roles must have an organization selected' },
        { status: 400 }
      )
    }
    
    // Log the attempt (without sensitive data)
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.USER_CREATE,
      'new',
      { 
        email: sanitizedData.email,
        full_name: sanitizedData.full_name,
        roles_count: sanitizedData.roles.length,
        primary_role: primaryRoles[0].role_type
      },
      request
    )

    console.log('Received user creation request:', { 
      email: sanitizedData.email,
      full_name: sanitizedData.full_name,
      roles_count: sanitizedData.roles.length,
      password: '[REDACTED]' 
    })
    
    // Validate required fields (redundant but good for logging)
    if (!sanitizedData.email || !sanitizedData.full_name || !sanitizedData.password || !sanitizedData.roles) {
      console.log('Missing required fields:', { 
        email: !!sanitizedData.email, 
        full_name: !!sanitizedData.full_name, 
        password: !!sanitizedData.password,
        roles: !!sanitizedData.roles
      })
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', missingFields: { 
          email: !!sanitizedData.email, 
          full_name: !!sanitizedData.full_name, 
          password: !!sanitizedData.password,
          roles: !!sanitizedData.roles
        }},
        false,
        'Missing required fields',
        request
      )
      return NextResponse.json(
        { error: 'Email, full name, password, and roles are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    console.log('Checking for existing user with email:', sanitizedData.email)
    const { data: existingUser, error: checkError } = await supabase
      .from('platform_users')
      .select('id')
      .eq('email', sanitizedData.email)
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
      email: sanitizedData.email,
      password: sanitizedData.password,
      email_confirm: true,
      user_metadata: {
        full_name: sanitizedData.full_name,
        role: primaryRoles[0].role_type // Use primary role for auth metadata
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
      .select('id')
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

    // Create all roles for the user
    console.log('Creating roles for user...')
    const roleData = sanitizedData.roles.map((role: any) => ({
      user_id: platformUser.id,
      role_type: role.role_type,
      organization_type: role.organization_type,
      organization_id: role.organization_id,
      is_active: true,
      is_primary: role.is_primary,
      permissions: role.permissions || {}
    }))

    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .insert(roleData)
      .select()

    if (roleError) {
      console.error('Error creating user roles:', roleError)
      // Clean up auth user and platform user
      await supabase.auth.admin.deleteUser(authUser.user.id)
      await supabase.from('platform_users').delete().eq('id', platformUser.id)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/users', method: 'POST', error: roleError.message },
        false,
        'Failed to create user roles',
        request
      )
      return NextResponse.json(
        { error: 'Failed to create user roles' },
        { status: 500 }
      )
    }

    // Fetch the complete user data with roles
    const { data: completeUser, error: fetchError } = await supabase
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
      .eq('id', platformUser.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete user data:', fetchError)
      return NextResponse.json(
        { error: 'User created but failed to fetch complete data' },
        { status: 500 }
      )
    }

    console.log('User created successfully with roles:', completeUser)
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.USER_CREATE,
      'success',
      { 
        email: completeUser.email,
        full_name: completeUser.full_name,
        roles_count: userRoles.length,
        primary_role: primaryRoles[0].role_type
      },
      request
    )
    return NextResponse.json(completeUser, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in POST /api/users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 