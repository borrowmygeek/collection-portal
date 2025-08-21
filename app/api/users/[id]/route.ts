import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, logSecurityEvent, logUserAction, AUDIT_ACTIONS } from '@/lib/audit-log'
import { sendRoleAssignmentEmail } from '@/lib/email'

// Force edge runtime for this API route
export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'GET', error: authError },
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
        { endpoint: `/api/users/${params.id}`, method: 'GET' },
        false,
        'Rate limit exceeded',
        request
      )
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check permissions - only platform admins can view individual users
    if (user.activeRole.roleType !== 'platform_admin') {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'GET', requiredRole: 'platform_admin', userRole: user.activeRole.roleType },
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
    
    const { data: userData, error } = await supabase
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
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'GET', error: error.message },
        false,
        'Database error',
        request
      )
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      )
    }

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Transform the data to include primary role and all roles
    const primaryRole = userData.user_roles?.find((role: any) => role.is_primary)
    const activeRoles = userData.user_roles?.filter((role: any) => role.is_active) || []
    
    const transformedUser = {
      ...userData,
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

    // Log successful data access
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.DATA_VIEW,
      'user',
      { user_id: params.id },
      request
    )

    return NextResponse.json(transformedUser)

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
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'PUT', error: authError },
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
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 20, 5 * 60 * 1000)
    if (!rateLimitResult.success) {
      await logSecurityEvent(
        user.auth_user_id,
        AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        { endpoint: `/api/users/${params.id}`, method: 'PUT' },
        false,
        'Rate limit exceeded',
        request
      )
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check permissions - only platform admins can update users
    if (user.activeRole.roleType !== 'platform_admin') {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'PUT', requiredRole: 'platform_admin', userRole: user.activeRole.roleType },
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
    
    // Validate required fields
    if (!body.full_name || !body.status) {
      return NextResponse.json(
        { error: 'Full name and status are required' },
        { status: 400 }
      )
    }

    // Get the current user to check if we need to update roles
    const { data: currentUser, error: fetchError } = await supabase
      .from('platform_users')
      .select(`
        auth_user_id,
        user_roles(
          id,
          role_type,
          organization_type,
          organization_id,
          is_primary
        )
      `)
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
        status: body.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
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
      .single()

    if (updateError) {
      console.error('Error updating platform user:', updateError)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'PUT', error: updateError.message },
        false,
        'Failed to update user',
        request
      )
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      )
    }

    // Handle role updates if provided
    if (body.roles && Array.isArray(body.roles)) {
      // Track new roles for email notifications
      const newRoles = []
      
      // Update existing roles or create new ones
      for (const roleUpdate of body.roles) {
        if (roleUpdate.id) {
          // Update existing role
          const { error: roleUpdateError } = await supabase
            .from('user_roles')
            .update({
              role_type: roleUpdate.role_type,
              organization_type: roleUpdate.organization_type,
              organization_id: roleUpdate.organization_id,
              is_active: roleUpdate.is_active,
              is_primary: roleUpdate.is_primary,
              permissions: roleUpdate.permissions || {}
            })
            .eq('id', roleUpdate.id)

          if (roleUpdateError) {
            console.error('Error updating role:', roleUpdateError)
          }
        } else {
          // Create new role
          const { error: roleCreateError } = await supabase
            .from('user_roles')
            .insert({
              user_id: params.id,
              role_type: roleUpdate.role_type,
              organization_type: roleUpdate.organization_type,
              organization_id: roleUpdate.organization_id,
              is_active: roleUpdate.is_active,
              is_primary: roleUpdate.is_primary,
              permissions: roleUpdate.permissions || {}
            })

          if (roleCreateError) {
            console.error('Error creating role:', roleCreateError)
          } else {
            // Track new role for email notification
            newRoles.push(roleUpdate)
          }
        }
      }
      
      // Send email notifications for new role assignments
      if (newRoles.length > 0) {
        try {
          // Get organization names for the new roles
          for (const newRole of newRoles) {
            let organizationName = 'Platform'
            
            if (newRole.organization_id && newRole.organization_type !== 'platform') {
              // Get organization name based on type
              if (newRole.organization_type === 'agency') {
                const { data: agency } = await supabase
                  .from('master_agencies')
                  .select('name')
                  .eq('id', newRole.organization_id)
                  .single()
                organizationName = agency?.name || 'Unknown Agency'
              } else if (newRole.organization_type === 'client') {
                const { data: client } = await supabase
                  .from('master_clients')
                  .select('name')
                  .eq('id', newRole.organization_id)
                  .single()
                organizationName = client?.name || 'Unknown Client'
              } else if (newRole.organization_type === 'buyer') {
                const { data: buyer } = await supabase
                  .from('master_buyers')
                  .select('company_name')
                  .eq('id', newRole.organization_id)
                  .single()
                organizationName = buyer?.company_name || 'Unknown Buyer'
              }
            }
            
            // Send role assignment email
            await sendRoleAssignmentEmail(
              updatedUser.email,
              updatedUser.full_name,
              newRole.role_type,
              organizationName,
              'Platform Admin'
            )
          }
        } catch (emailError) {
          console.error('Error sending role assignment emails:', emailError)
          // Don't fail the request if email fails
        }
      }
    }

    // Log the user update
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.USER_UPDATE,
      'user',
      { 
        user_id: params.id,
        full_name: body.full_name,
        status: body.status,
        roles_updated: !!body.roles
      },
      request
    )

    // Transform the response data
    const primaryRole = updatedUser.user_roles?.find((role: any) => role.is_primary)
    const activeRoles = updatedUser.user_roles?.filter((role: any) => role.is_active) || []
    
    const transformedUser = {
      ...updatedUser,
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

    return NextResponse.json(transformedUser)

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
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'DELETE', error: authError },
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
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 5, 5 * 60 * 1000)
    if (!rateLimitResult.success) {
      await logSecurityEvent(
        user.auth_user_id,
        AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        { endpoint: `/api/users/${params.id}`, method: 'DELETE' },
        false,
        'Rate limit exceeded',
        request
      )
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    // Check permissions - only platform admins can delete users
    if (user.activeRole.roleType !== 'platform_admin') {
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'DELETE', requiredRole: 'platform_admin', userRole: user.activeRole.roleType },
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
    
    // Get the current user to get auth_user_id
    const { data: currentUser, error: fetchError } = await supabase
      .from('platform_users')
      .select('auth_user_id, email, full_name')
      .eq('id', params.id)
      .single()

    if (fetchError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Delete user roles first (cascade should handle this, but explicit for safety)
    const { error: rolesDeleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', params.id)

    if (rolesDeleteError) {
      console.error('Error deleting user roles:', rolesDeleteError)
    }

    // Delete platform user record
    const { error: deleteError } = await supabase
      .from('platform_users')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting platform user:', deleteError)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: `/api/users/${params.id}`, method: 'DELETE', error: deleteError.message },
        false,
        'Failed to delete user',
        request
      )
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

    // Log the user deletion
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.USER_DELETE,
      'user',
      { 
        deleted_user_id: params.id,
        deleted_user_email: currentUser.email,
        deleted_user_name: currentUser.full_name
      },
      request
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 