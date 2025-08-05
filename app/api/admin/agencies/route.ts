import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataModification } from '@/lib/audit-log'

// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 5, 60000) // 5 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' }
        }
      )
    }

    // Check if user has permission to create agencies
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    
    // Get the agency data from the request body
    const agencyData = await request.json()

    // Validate required fields
    if (!agencyData.name || !agencyData.code || !agencyData.contact_email) {
      return NextResponse.json(
        { error: 'Missing required fields: name, code, contact_email' },
        { status: 400 }
      )
    }

    // Insert the agency using the service role (bypasses RLS)
    const { data, error } = await supabase
      .from('master_agencies')
      .insert([agencyData])
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create agency', details: error },
        { status: 500 }
      )
    }

    const createdAgency = data[0]

    // Log the data modification
    await logDataModification(
      user.auth_user_id,
      'AGENCY_CREATE',
      'master_agencies',
      createdAgency.id,
      { agencyData, createdAgency },
      request
    )

    return NextResponse.json({ 
      success: true, 
      agency: createdAgency 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 