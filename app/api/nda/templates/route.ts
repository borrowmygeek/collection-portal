import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'

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
    
    // Get all NDA templates
    const { data: templates, error } = await supabase
      .from('nda_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching NDA templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch NDA templates' },
        { status: 500 }
      )
    }

    return NextResponse.json(templates)

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.version || !body.title || !body.content) {
      return NextResponse.json(
        { error: 'Version, title, and content are required' },
        { status: 400 }
      )
    }

    // Check if version already exists
    const { data: existingTemplate } = await supabase
      .from('nda_templates')
      .select('id')
      .eq('version', body.version)
      .single()

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'NDA template version already exists' },
        { status: 409 }
      )
    }

    // If this template is being set as active, deactivate others
    if (body.is_active) {
      await supabase
        .from('nda_templates')
        .update({ is_active: false })
        .eq('is_active', true)
    }

    // Create the NDA template
    const { data: template, error } = await supabase
      .from('nda_templates')
      .insert({
        version: body.version,
        title: body.title,
        content: body.content,
        is_active: body.is_active || false,
        effective_date: body.effective_date || new Date().toISOString(),
        expiry_date: body.expiry_date,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating NDA template:', error)
      return NextResponse.json(
        { error: 'Failed to create NDA template' },
        { status: 500 }
      )
    }

    return NextResponse.json(template, { status: 201 })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Check if template exists
    const { data: existingTemplate } = await supabase
      .from('nda_templates')
      .select('id')
      .eq('id', body.id)
      .single()

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'NDA template not found' },
        { status: 404 }
      )
    }

    // If this template is being set as active, deactivate others
    if (body.is_active) {
      await supabase
        .from('nda_templates')
        .update({ is_active: false })
        .eq('is_active', true)
    }

    // Update the NDA template
    const { data: template, error } = await supabase
      .from('nda_templates')
      .update({
        version: body.version,
        title: body.title,
        content: body.content,
        is_active: body.is_active,
        effective_date: body.effective_date,
        expiry_date: body.expiry_date,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating NDA template:', error)
      return NextResponse.json(
        { error: 'Failed to update NDA template' },
        { status: 500 }
      )
    }

    return NextResponse.json(template)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Check if template exists and is not active
    const { data: template } = await supabase
      .from('nda_templates')
      .select('id, is_active')
      .eq('id', id)
      .single()

    if (!template) {
      return NextResponse.json(
        { error: 'NDA template not found' },
        { status: 404 }
      )
    }

    if (template.is_active) {
      return NextResponse.json(
        { error: 'Cannot delete active NDA template' },
        { status: 400 }
      )
    }

    // Delete the NDA template
    const { error } = await supabase
      .from('nda_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting NDA template:', error)
      return NextResponse.json(
        { error: 'Failed to delete NDA template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'NDA template deleted successfully' })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 