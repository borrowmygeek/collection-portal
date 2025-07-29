import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role client for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user'
  agency_id?: string
  auth_user_id: string
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

    // Verify the JWT token and get user info
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    console.log('🔍 authenticateApiRequest: Auth result:', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError?.message
    })
    
    if (authError || !user) {
      console.log('❌ authenticateApiRequest: Invalid or expired token')
      return { user: null, error: 'Invalid or expired token' }
    }

    // Get the user's platform profile
    const { data: platformUser, error: platformError } = await supabaseAdmin
      .from('platform_users')
      .select('id, email, role, agency_id, auth_user_id')
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

    console.log('✅ authenticateApiRequest: Authentication successful')
    return { 
      user: platformUser as AuthenticatedUser, 
      error: null 
    }
  } catch (error) {
    console.error('❌ authenticateApiRequest: Authentication error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

export function requireRole(user: AuthenticatedUser, allowedRoles: string[]): boolean {
  return allowedRoles.includes(user.role)
}

export function requireAgencyAccess(user: AuthenticatedUser, agencyId: string): boolean {
  return user.role === 'platform_admin' || 
         (user.role.startsWith('agency_') && user.agency_id === agencyId)
}

// Note: client_id is not available in platform_users table
// Client access should be handled through agency relationships
export function requireClientAccess(user: AuthenticatedUser, clientId: string): boolean {
  // For now, only platform admins have client access
  // This should be enhanced when client relationships are properly modeled
  return user.role === 'platform_admin'
}

export function requirePlatformAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'platform_admin'
}

export function requireAgencyAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'platform_admin' || user.role === 'agency_admin'
}

export function requireClientAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'platform_admin' || user.role === 'client_admin'
} 