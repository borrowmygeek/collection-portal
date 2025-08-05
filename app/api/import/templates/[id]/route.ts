import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'

// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

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
    if (template.created_by !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to update this template' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, import_type, field_mappings, validation_rules } = body

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

    // Convert field_mappings to required_columns and optional_columns format
    const requiredColumns = field_mappings ? Object.keys(field_mappings).filter(key => 
      field_mappings[key] && field_mappings[key].trim() !== ''
    ) : []
    const optionalColumns = field_mappings ? Object.keys(field_mappings).filter(key => 
      !field_mappings[key] || field_mappings[key].trim() === ''
    ) : []

    // Update the template
    const { data: updatedTemplate, error } = await supabase
      .from('import_templates')
      .update({
        name,
        description,
        import_type,
        field_mappings: field_mappings || {},
        required_columns: requiredColumns,
        optional_columns: optionalColumns,
        validation_rules: validation_rules || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

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
    if (template.created_by !== user.id) {
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