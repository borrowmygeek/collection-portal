import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, logSecurityEvent, logUserAction, AUDIT_ACTIONS } from '@/lib/audit-log'
import { sendNDAConfirmationEmail } from '@/lib/email'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

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
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/nda/compliance', method: 'GET', error: authError },
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
        { endpoint: '/api/nda/compliance', method: 'GET' },
        false,
        'Rate limit exceeded',
        request
      )
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    // Get NDA compliance for the user
    const { data: complianceData, error } = await supabase.rpc(
      'get_user_nda_compliance_for_roles',
      { p_user_id: user.id }
    )

    if (error) {
      console.error('Error fetching NDA compliance:', error)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/nda/compliance', method: 'GET', error: error.message },
        false,
        'Database error',
        request
      )
      return NextResponse.json(
        { error: 'Failed to fetch NDA compliance' },
        { status: 500 }
      )
    }

    // Get current NDA version
    const { data: currentVersion, error: versionError } = await supabase.rpc('get_current_nda_version')
    
    if (versionError) {
      console.error('Error fetching current NDA version:', versionError)
    }

    // Log successful data access
    await logDataAccess(
      user.id,
      'nda_compliance',
      'user_nda_compliance',
      undefined,
      { user_id: user.id },
      request
    )

    return NextResponse.json({
      compliance: complianceData,
      currentVersion: currentVersion || '1.0'
    })

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
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/nda/compliance', method: 'POST', error: authError },
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
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 10, 5 * 60 * 1000)
    if (!rateLimitResult.success) {
      await logSecurityEvent(
        user.auth_user_id,
        AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        { endpoint: '/api/nda/compliance', method: 'POST' },
        false,
        'Rate limit exceeded',
        request
      )
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { ndaVersion, documentHash, notes } = body

    // Validate required fields
    if (!ndaVersion) {
      return NextResponse.json(
        { error: 'NDA version is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    // Get client IP and user agent
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Sign NDA for the user
    const { data: signResult, error } = await supabase.rpc('sign_nda_for_user', {
      p_user_id: user.id,
      p_nda_version: ndaVersion,
      p_signed_by: user.id, // Self-signed
      p_document_hash: documentHash,
      p_ip_address: clientIP,
      p_user_agent: userAgent,
      p_notes: notes
    })

    if (error) {
      console.error('Error signing NDA:', error)
      await logSecurityEvent(
        user.id,
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/nda/compliance', method: 'POST', error: error.message },
        false,
        'Failed to sign NDA',
        request
      )
      return NextResponse.json(
        { error: 'Failed to sign NDA' },
        { status: 500 }
      )
    }

    if (!signResult.success) {
      return NextResponse.json(
        { error: signResult.error },
        { status: 400 }
      )
    }

    // Log the NDA signing
    await logUserAction(
      user.id,
      AUDIT_ACTIONS.USER_UPDATE,
      'nda_compliance',
      { 
        user_id: user.id,
        nda_version: ndaVersion,
        action: 'nda_signed',
        ip_address: clientIP
      },
      request
    )

    // Send NDA confirmation email
    try {
      // Get user details for email
      const { data: userDetails } = await supabase
        .from('platform_users')
        .select('email, full_name')
        .eq('id', user.id)
        .single()

      if (userDetails) {
        // Get buyer company name if this is a buyer
        const { data: buyerDetails } = await supabase
          .from('master_buyers')
          .select('company_name')
          .eq('id', user.id)
          .single()

        const companyName = buyerDetails?.company_name || 'Collection Portal'
        
        await sendNDAConfirmationEmail(
          userDetails.email,
          companyName,
          userDetails.full_name || 'User'
        )
      }
    } catch (emailError) {
      console.error('Error sending NDA confirmation email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'NDA signed successfully',
      data: signResult
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 