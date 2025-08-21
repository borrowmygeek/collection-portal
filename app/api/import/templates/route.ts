import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
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

    // Get templates - users can see all templates
    const { data: templates, error } = await supabase
      .from('import_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    console.error('Error in templates GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [TEMPLATE CREATE] Starting template creation...')
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    console.log('🔍 [TEMPLATE CREATE] Auth result:', { 
      success: !!authResult.user, 
      error: authResult.error,
      userId: authResult.user?.id
    })
    
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult
    const body = await request.json()
    console.log('🔍 [TEMPLATE CREATE] Request body:', body)
    
    const { name, description, import_type, field_mappings, validation_rules } = body

    // Validate required fields
    if (!name || !import_type) {
      console.error('❌ [TEMPLATE CREATE] Missing required fields:', { name, import_type })
      return NextResponse.json({ error: 'Name and import_type are required' }, { status: 400 })
    }

    console.log('🔍 [TEMPLATE CREATE] Checking for existing template with name:', name)
    
    // Check if template name already exists for this user
    const { data: existingTemplate, error: checkError } = await supabase
      .from('import_templates')
      .select('id')
      .eq('created_by', user.id)
      .eq('name', name)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ [TEMPLATE CREATE] Error checking existing template:', checkError)
      return NextResponse.json({ error: 'Failed to check existing templates' }, { status: 500 })
    }

    if (existingTemplate) {
      console.log('❌ [TEMPLATE CREATE] Template name already exists')
      return NextResponse.json({ 
        error: `A template with the name "${name}" already exists. Please choose a different name.` 
      }, { status: 400 })
    }

    console.log('🔍 [TEMPLATE CREATE] Creating template with data:', {
      name,
      description,
      import_type,
      field_mappings: field_mappings || {},
      created_by: user.id
    })

    // Create template with field_mappings as JSON object
    const { data: template, error } = await supabase
      .from('import_templates')
      .insert({
        name,
        description,
        import_type,
        field_mappings: field_mappings || {},
        required_columns: [], // Keep for backward compatibility
        optional_columns: [], // Keep for backward compatibility
        sample_data: [],
        validation_rules: validation_rules || [],
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [TEMPLATE CREATE] Database error creating template:', error)
      console.error('❌ [TEMPLATE CREATE] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    console.log('✅ [TEMPLATE CREATE] Template created successfully:', template)
    return NextResponse.json({ template })
  } catch (error) {
    console.error('❌ [TEMPLATE CREATE] Unexpected error:', error)
    console.error('❌ [TEMPLATE CREATE] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 