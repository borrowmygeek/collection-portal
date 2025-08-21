import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create client with anon key for user operations (respects RLS)
function createAuthSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Create admin client with service role key for server-side auth (bypasses RLS)
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // During build time, environment variables might not be available
  // Return a dummy client that will throw an error if actually used
  if (!supabaseUrl || !supabaseServiceKey) {
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
      // This is likely a build-time execution, return a dummy client
      return {
        from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }),
        rpc: () => ({ data: null, error: null }),
        auth: { getUser: () => ({ data: { user: null }, error: null }) },
      } as any
    }
    throw new Error('Supabase admin environment variables not configured')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Updated interface to support multi-role system
export interface AuthenticatedUser {
  id: string
  email: string
  auth_user_id: string
  // Current active role information
  activeRole: {
    roleId: string
    roleType: 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer'
    organizationType: 'platform' | 'agency' | 'client' | 'buyer'
    organizationId?: string
    organizationName: string
    permissions: Record<string, any>
  }
  // All available roles for the user
  availableRoles: Array<{
    id: string
    roleType: 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer'
    organizationType: 'platform' | 'agency' | 'client' | 'buyer'
    organizationId?: string
    organizationName: string
    isPrimary: boolean
    isActive: boolean
    permissions: Record<string, any>
  }>
}

// Role session interface
export interface RoleSession {
  sessionToken: string
  roleId: string
  expiresAt: string
}

export async function authenticateApiRequest(req: NextRequest): Promise<{
  user: AuthenticatedUser | null
  error: string | null
}> {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    console.log('🔍 authenticateApiRequest: Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ authenticateApiRequest: Missing or invalid authorization header')
      return { user: null, error: 'Missing or invalid authorization header' }
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log('🔍 authenticateApiRequest: Token length:', token.length)

    // Use admin client for JWT verification to ensure proper permissions
    const supabase = createAdminSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    console.log('🔍 authenticateApiRequest: Auth result:', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError?.message
    })
    
    if (authError || !user) {
      console.log('❌ authenticateApiRequest: Invalid or expired token')
      return { user: null, error: 'Invalid or expired token' }
    }

    // Get the user's platform profile using admin client
    const { data: platformUser, error: platformError } = await supabase
      .from('platform_users')
      .select('id, email, auth_user_id')
      .eq('auth_user_id', user.id)
      .single()

    console.log('🔍 authenticateApiRequest: Platform user result:', {
      hasPlatformUser: !!platformUser,
      hasError: !!platformError,
      errorMessage: platformError?.message
    })

    if (platformError || !platformUser) {
      console.log('❌ authenticateApiRequest: User not found in platform')
      return { user: null, error: 'User not found in platform' }
    }

    // Get role session token from headers
    const roleSessionToken = req.headers.get('x-role-session-token')

    // Get user's active role and all available roles using simplified functions
    const { data: activeRoleData, error: activeRoleError } = await supabase
      .rpc('get_user_active_role_simple', { 
        p_user_id: platformUser.id
      })

    const { data: allRolesData, error: allRolesError } = await supabase
      .rpc('get_user_roles_simple', { p_user_id: platformUser.id })

    if (activeRoleError || !activeRoleData) {
      console.log('❌ authenticateApiRequest: Failed to get active role:', activeRoleError)
      // Return a fallback role instead of failing completely
      const authenticatedUser: AuthenticatedUser = {
        id: platformUser.id,
        email: platformUser.email,
        auth_user_id: platformUser.auth_user_id,
        activeRole: {
          roleId: 'fallback',
          roleType: 'platform_admin',
          organizationType: 'platform',
          organizationId: undefined,
          organizationName: 'Platform',
          permissions: {}
        },
        availableRoles: allRolesData || []
      }
      return { user: authenticatedUser, error: null }
    }

    // Log any errors with roles but don't fail completely
    if (allRolesError) {
      console.log('⚠️ authenticateApiRequest: Failed to get all roles:', allRolesError)
    }

    // Transform the allRolesData to camelCase format
    const transformedAvailableRoles = (allRolesData || []).map((role: any) => ({
      id: role.id,
      roleType: role.role_type,
      organizationType: role.organization_type,
      organizationId: role.organization_id,
      organizationName: role.organization_name,
      isPrimary: role.is_primary,
      isActive: role.is_active,
      permissions: role.permissions || {}
    }))

    // Use the active role returned by get_user_active_role (which now handles session tokens)
    const authenticatedUser: AuthenticatedUser = {
      id: platformUser.id,
      email: platformUser.email,
      auth_user_id: platformUser.auth_user_id,
      activeRole: {
        roleId: activeRoleData.role_id,
        roleType: activeRoleData.role_type,
        organizationType: activeRoleData.organization_type,
        organizationId: activeRoleData.organization_id,
        organizationName: activeRoleData.organization_name || 'Unknown Organization',
        permissions: activeRoleData.permissions || {}
      },
      availableRoles: transformedAvailableRoles
    }

    console.log('✅ authenticateApiRequest: Authentication successful')
    return { user: authenticatedUser, error: null }
  } catch (error) {
    console.error('❌ authenticateApiRequest: Authentication error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

// Create a new role session
export async function createRoleSession(roleId: string, sessionDurationHours: number = 24, userId?: string): Promise<{
  session: RoleSession | null
  error: string | null
}> {
  try {
    // Use server-side version if userId is provided, otherwise use client-side version
    const supabaseAdmin = createAdminSupabaseClient() // Use a separate client for admin operations
    const rpcFunction = userId ? 'create_role_session_server' : 'create_role_session'
    const rpcParams = userId 
      ? { 
          p_user_id: userId,
          p_role_id: roleId, 
          p_session_duration_hours: sessionDurationHours 
        }
      : { 
          p_role_id: roleId, 
          p_session_duration_hours: sessionDurationHours 
        }

    const { data: sessionToken, error } = await supabaseAdmin
      .rpc(rpcFunction, rpcParams)

    if (error || !sessionToken) {
      return { session: null, error: error?.message || 'Failed to create role session' }
    }

    // Get session details
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('user_role_sessions')
      .select('session_token, role_id, expires_at')
      .eq('session_token', sessionToken)
      .single()

    if (sessionError || !sessionData) {
      return { session: null, error: 'Failed to get session details' }
    }

    const session: RoleSession = {
      sessionToken: sessionData.session_token,
      roleId: sessionData.role_id,
      expiresAt: sessionData.expires_at
    }

    return { session, error: null }
  } catch (error) {
    console.error('❌ createRoleSession: Error:', error)
    return { session: null, error: 'Failed to create role session' }
  }
}

// Get all roles for a user
export async function getUserRoles(userId: string): Promise<{
  roles: AuthenticatedUser['availableRoles']
  error: string | null
}> {
  try {
    const supabaseAdmin = createAdminSupabaseClient() // Use a separate client for admin operations
    const { data: roles, error } = await supabaseAdmin
      .rpc('get_user_roles_simple', { p_user_id: userId })

    if (error) {
      return { roles: [], error: error.message }
    }

    // Transform the snake_case response to camelCase format
    const transformedRoles = (roles || []).map((role: any) => ({
      id: role.id,
      roleType: role.role_type,
      organizationType: role.organization_type,
      organizationId: role.organization_id,
      organizationName: role.organization_name,
      isPrimary: role.is_primary,
      isActive: role.is_active,
      permissions: role.permissions || {}
    }))

    return { roles: transformedRoles, error: null }
  } catch (error) {
    console.error('❌ getUserRoles: Error:', error)
    return { roles: [], error: 'Failed to get user roles' }
  }
}

// Check if user has a specific role in their available roles
export function hasRole(user: AuthenticatedUser, roleType: string, organizationType?: string, organizationId?: string): boolean {
  return user.availableRoles.some(role => {
    const roleMatch = role.roleType === roleType
    const orgTypeMatch = !organizationType || role.organizationType === organizationType
    const orgIdMatch = !organizationId || role.organizationId === organizationId
    return roleMatch && orgTypeMatch && orgIdMatch && role.isActive
  })
}

// Get organization name for current role
export function getCurrentOrganizationName(user: AuthenticatedUser): string {
  const currentRole = user.availableRoles.find(role => role.id === user.activeRole.roleId)
  return currentRole?.organizationName || 'Unknown Organization'
}

// Check if user can switch to a specific role
export function canSwitchToRole(user: AuthenticatedUser, roleId: string): boolean {
  return user.availableRoles.some(role => 
    role.id === roleId && role.isActive
  )
} 