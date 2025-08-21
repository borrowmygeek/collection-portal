import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }

    const { data: template, error } = await supabase
      .from('import_templates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching template:', error)
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error in template GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult

    // Get existing template
    const { data: template, error: fetchError } = await supabase
      .from('import_templates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if user has permission to update this template
    console.log('🔍 [TEMPLATE UPDATE] Permission check:', {
      templateCreatedBy: template.created_by,
      currentUserId: user.id,
      templateId: params.id,
      templateName: template.name
    })
    
    // Allow update if:
    // 1. User created the template, OR
    // 2. Template has no created_by (legacy templates), OR  
    // 3. User is a platform admin
    const canUpdate = (
      template.created_by === user.id || 
      !template.created_by ||
      user.activeRole.roleType === 'platform_admin'
    )
    
    if (!canUpdate) {
      console.log('❌ [TEMPLATE UPDATE] Permission denied:', {
        templateCreatedBy: template.created_by,
        currentUserId: user.id,
        userRole: user.activeRole.roleType,
        mismatch: template.created_by !== user.id
      })
      return NextResponse.json({ 
        error: 'Unauthorized to update this template',
        details: {
          templateCreatedBy: template.created_by,
          currentUserId: user.id,
          userRole: user.activeRole.roleType,
          reason: 'Template was created by a different user and you are not a platform admin'
        }
      }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, import_type, field_mappings, validation_rules } = body

    console.log('🔍 [TEMPLATE UPDATE] Request body:', {
      name,
      description,
      import_type,
      field_mappings,
      validation_rules,
      fieldMappingsType: typeof field_mappings,
      fieldMappingsKeys: field_mappings ? Object.keys(field_mappings) : null
    })

    // Validate required fields
    if (!name || !import_type) {
      return NextResponse.json({ error: 'Name and import_type are required' }, { status: 400 })
    }

    // Check if new name conflicts with existing template
    if (name !== template.name) {
      const { data: existingTemplate } = await supabase
        .from('import_templates')
        .select('id')
        .eq('created_by', user.id)
        .eq('name', name)
        .neq('id', params.id)
        .single()

      if (existingTemplate) {
        return NextResponse.json({ 
          error: `A template with the name "${name}" already exists. Please choose a different name.` 
        }, { status: 400 })
      }
    }

    // For template updates, we should preserve the existing required/optional column structure
    // and only update the field_mappings. The required_columns and optional_columns
    // should represent the field definitions, not the current mapping status.
    
    // Get the existing template structure to preserve required vs optional field definitions
    const existingRequiredColumns = template.required_columns || []
    const existingOptionalColumns = template.optional_columns || []
    
    // Only update field_mappings, preserve the existing column structure
    const requiredColumns = existingRequiredColumns
    const optionalColumns = existingOptionalColumns

    // Update the template
    const updateData = {
      name,
      description,
      import_type,
      field_mappings: field_mappings || {},
      required_columns: requiredColumns,
      optional_columns: optionalColumns,
      validation_rules: validation_rules || [],
      updated_at: new Date().toISOString()
    }
    
    console.log('🔍 [TEMPLATE UPDATE] Update data being sent to database:', {
      updateData,
      templateId: params.id
    })
    
    const { data: updatedTemplate, error } = await supabase
      .from('import_templates')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('❌ [TEMPLATE UPDATE] Database error:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    console.log('✅ [TEMPLATE UPDATE] Database update successful:', {
      updatedTemplate: updatedTemplate,
      updatedFieldMappings: updatedTemplate.field_mappings
    })

    return NextResponse.json({ template: updatedTemplate })
  } catch (error) {
    console.error('Error in template PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult

    // Get existing template to check ownership
    const { data: template, error: fetchError } = await supabase
      .from('import_templates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if user has permission to delete this template
    // Allow delete if:
    // 1. User created the template, OR
    // 2. Template has no created_by (legacy templates), OR  
    // 3. User is a platform admin
    const canDelete = (
      template.created_by === user.id || 
      !template.created_by ||
      user.activeRole.roleType === 'platform_admin'
    )
    
    if (!canDelete) {
      console.log('❌ [TEMPLATE DELETE] Permission denied:', {
        templateCreatedBy: template.created_by,
        currentUserId: user.id,
        templateId: params.id,
        templateName: template.name,
        userRole: user.activeRole.roleType
      })
      return NextResponse.json({ error: 'Unauthorized to delete this template' }, { status: 403 })
    }

    // Delete the template
    const { error } = await supabase
      .from('import_templates')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Template deleted successfully' 
    })
  } catch (error) {
    console.error('Error in template DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 