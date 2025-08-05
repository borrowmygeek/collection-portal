import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest, createRoleSession, getUserRoles } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logUserAction } from '@/lib/audit'

const supabase = createAdminSupabaseClient()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 GET /api/auth/roles: Starting authentication...')
    
    // Authenticate user first
    const { user, error: authError } = await authenticateApiRequest(request)
    
    console.log('🔍 GET /api/auth/roles: Auth result:', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError
    })
    
    if (authError || !user) {
      console.log('❌ GET /api/auth/roles: Authentication failed:', authError)
      return NextResponse.json(
        { error: authError || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.id, 10, 60 * 1000) // 10 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Get all roles for the user
    const { roles, error: rolesError } = await getUserRoles(user.id)
    if (rolesError) {
      return NextResponse.json(
        { error: rolesError },
        { status: 500 }
      )
    }

    // Log the action
    await logUserAction(user.id, 'GET_ROLES', {
      user_id: user.id,
      roles_count: roles.length
    })

    return NextResponse.json({
      success: true,
      roles: roles,
      currentRole: user.activeRole
    })

  } catch (error) {
    console.error('❌ GET /api/auth/roles error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 POST /api/auth/roles: Function called')
  
  try {
    console.log('🔍 POST /api/auth/roles: Starting role switch...')
    
    // Authenticate user first
    const { user, error: authError } = await authenticateApiRequest(request)
    
    console.log('🔍 POST /api/auth/roles: Auth result:', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError,
      availableRolesType: typeof user?.availableRoles,
      availableRolesLength: user?.availableRoles?.length,
      availableRoles: user?.availableRoles
    })
    
    if (authError || !user) {
      console.log('❌ POST /api/auth/roles: Authentication failed:', authError)
      return NextResponse.json(
        { error: authError || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.id, 5, 60 * 1000) // 5 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { roleId, sessionDurationHours = 24 } = body

    console.log('🔍 POST /api/auth/roles: Request body:', {
      roleId,
      sessionDurationHours,
      availableRoles: user.availableRoles?.length || 0
    })

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      )
    }

    // Log available roles for debugging
    console.log('🔍 POST /api/auth/roles: Available roles:', user.availableRoles?.map(role => ({
      id: role.id,
      roleType: role.roleType,
      isActive: role.isActive,
      organizationName: role.organizationName
    })))

    // Safety check for availableRoles
    if (!user.availableRoles || user.availableRoles.length === 0) {
      console.log('❌ POST /api/auth/roles: No available roles found')
      return NextResponse.json(
        { error: 'No available roles found' },
        { status: 403 }
      )
    }

    // Verify user can switch to this role
    const canSwitch = user.availableRoles.some(role => 
      role.id === roleId
    )

    console.log('🔍 POST /api/auth/roles: Can switch check:', {
      requestedRoleId: roleId,
      canSwitch,
      matchingRoles: user.availableRoles?.filter(role => role.id === roleId),
      totalAvailableRoles: user.availableRoles?.length || 0
    })

    if (!canSwitch) {
      console.log('❌ POST /api/auth/roles: Cannot switch to role:', roleId)
      return NextResponse.json(
        { error: 'Cannot switch to specified role' },
        { status: 403 }
      )
    }

    // Get the role details
    const targetRole = user.availableRoles.find(role => role.id === roleId)
    if (!targetRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    // Check NDA compliance for buyer roles
    if (targetRole.roleType === 'buyer') {
      // Find the buyer record for this user
      const { data: buyer, error: buyerError } = await supabase
        .from('master_buyers')
        .select('id, nda_compliance_status, current_nda_version, nda_version_signed')
        .eq('user_id', user.id)
        .single()

      if (buyerError || !buyer) {
        return NextResponse.json(
          { error: 'Buyer profile not found' },
          { status: 404 }
        )
      }

      // Check NDA compliance
      const { data: compliance, error: complianceError } = await supabase
        .rpc('check_buyer_nda_compliance', { buyer_uuid: buyer.id })

      if (complianceError) {
        console.error('Error checking NDA compliance:', complianceError)
        return NextResponse.json(
          { error: 'Failed to verify NDA compliance' },
          { status: 500 }
        )
      }

      if (!compliance || !Array.isArray(compliance) || compliance.length === 0) {
        return NextResponse.json(
          { error: 'No compliance data found' },
          { status: 500 }
        )
      }

      const complianceResult = compliance[0] as any
      if (!complianceResult?.is_compliant) {
        return NextResponse.json({
          error: 'NDA compliance required',
          compliance: {
            is_compliant: false,
            current_version: complianceResult?.current_version,
            signed_version: complianceResult?.signed_version,
            status: complianceResult?.compliance_status,
            message: complianceResult?.message
          },
          requires_nda: true
        }, { status: 403 })
      }
    }

    // Create role session
    const { session, error: sessionError } = await createRoleSession(roleId, sessionDurationHours, user.id)
    if (sessionError || !session) {
      return NextResponse.json(
        { error: sessionError || 'Failed to create role session' },
        { status: 500 }
      )
    }

    // Log the role switch
    await logUserAction(user.id, 'ROLE_SWITCHED', {
      user_id: user.id,
      from_role_id: user.activeRole.roleId,
      to_role_id: roleId,
      organization_type: targetRole.organizationType,
      organization_id: targetRole.organizationId
    })

    return NextResponse.json({
      success: true,
      session: {
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt
      },
      newRole: {
        roleId: targetRole.id,
        roleType: targetRole.roleType,
        organizationType: targetRole.organizationType,
        organizationId: targetRole.organizationId,
        organizationName: targetRole.organizationName
      }
    })

  } catch (error) {
    console.error('❌ POST /api/auth/roles error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 