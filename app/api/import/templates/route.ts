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
    const body = await request.json()
    const { name, description, import_type, field_mappings, validation_rules } = body

    // Validate required fields
    if (!name || !import_type) {
      return NextResponse.json({ error: 'Name and import_type are required' }, { status: 400 })
    }

    // Check if template name already exists for this user
    const { data: existingTemplate } = await supabase
      .from('import_templates')
      .select('id')
      .eq('created_by', user.id)
      .eq('name', name)
      .single()

    if (existingTemplate) {
      return NextResponse.json({ 
        error: `A template with the name "${name}" already exists. Please choose a different name.` 
      }, { status: 400 })
    }

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
      console.error('Error creating template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error in templates POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 