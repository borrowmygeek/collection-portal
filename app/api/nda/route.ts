import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const buyer_id = searchParams.get('buyer_id')
    const template_only = searchParams.get('template_only') === 'true'

    // If template_only is requested, return current NDA template
    if (template_only) {
      const { data: template, error: templateError } = await supabase
        .rpc('get_current_nda_template')

      if (templateError) {
        console.error('Error fetching NDA template:', templateError)
        return NextResponse.json(
          { error: 'Failed to fetch NDA template' },
          { status: 500 }
        )
      }

      return NextResponse.json({ template })
    }

    // If buyer_id is provided, get their NDA compliance status
    if (buyer_id) {
      const { data: compliance, error: complianceError } = await supabase
        .rpc('check_buyer_nda_compliance', { buyer_uuid: buyer_id })

      if (complianceError) {
        console.error('Error checking NDA compliance:', complianceError)
        return NextResponse.json(
          { error: 'Failed to check NDA compliance' },
          { status: 500 }
        )
      }

      // Get the most recent active NDA for this buyer
      const { data: nda, error: ndaError } = await supabase
        .from('nda_agreements')
        .select('*')
        .eq('buyer_id', buyer_id)
        .eq('status', 'active')
        .order('signed_at', { ascending: false })
        .limit(1)
        .single()

      if (ndaError && ndaError.code !== 'PGRST116') {
        console.error('Error fetching NDA:', ndaError)
        return NextResponse.json(
          { error: 'Failed to fetch NDA' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        compliance: compliance[0], 
        nda,
        template: await supabase.rpc('get_current_nda_template')
      })
    }

    // If no buyer_id, return current template
    const { data: template, error: templateError } = await supabase
      .rpc('get_current_nda_template')

    if (templateError) {
      console.error('Error fetching NDA template:', templateError)
      return NextResponse.json(
        { error: 'Failed to fetch NDA template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template })

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
    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult

    // Validate required fields
    if (!body.buyer_id || !body.agreement_text) {
      return NextResponse.json(
        { error: 'Buyer ID and agreement text are required' },
        { status: 400 }
      )
    }

    // Verify the buyer belongs to this user
    const { data: buyer } = await supabase
      .from('master_buyers')
      .select('id, user_id')
      .eq('id', body.buyer_id)
      .single()

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    if (buyer.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get current NDA template
    const { data: template, error: templateError } = await supabase
      .rpc('get_current_nda_template')

    if (templateError || !template) {
      console.error('Error fetching NDA template:', templateError)
      return NextResponse.json(
        { error: 'No active NDA template found' },
        { status: 500 }
      )
    }

    // Get client IP and user agent
    const ip_address = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown'
    const user_agent = request.headers.get('user-agent') || 'unknown'

    // Create the NDA agreement with template reference
    const { data: nda, error } = await supabase
      .from('nda_agreements')
      .insert({
        buyer_id: body.buyer_id,
        agreement_version: template.version,
        template_id: template.id,
        template_version: template.version,
        agreement_text: body.agreement_text,
        ip_address: ip_address,
        user_agent: user_agent,
        expires_at: body.expires_at
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating NDA:', error)
      return NextResponse.json(
        { error: 'Failed to create NDA' },
        { status: 500 }
      )
    }

    // Update the buyer's NDA status with version information
    const { error: updateError } = await supabase
      .from('master_buyers')
      .update({
        nda_signed: true,
        nda_signed_date: new Date().toISOString(),
        nda_ip_address: ip_address,
        nda_version_signed: template.version,
        current_nda_version: template.version,
        nda_compliance_status: 'compliant',
        status: 'approved'
      })
      .eq('id', body.buyer_id)

    if (updateError) {
      console.error('Error updating buyer NDA status:', updateError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json(nda, { status: 201 })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 