import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Only create client if environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const buyer_id = searchParams.get('buyer_id')

    if (!buyer_id) {
      return NextResponse.json(
        { error: 'Buyer ID is required' },
        { status: 400 }
      )
    }

    // Get the most recent active NDA for this buyer
    const { data: nda, error } = await supabase
      .from('nda_agreements')
      .select('*')
      .eq('buyer_id', buyer_id)
      .eq('status', 'active')
      .order('signed_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching NDA:', error)
      return NextResponse.json(
        { error: 'Failed to fetch NDA' },
        { status: 500 }
      )
    }

    return NextResponse.json({ nda })

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
    const supabase = createSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.buyer_id || !body.agreement_text) {
      return NextResponse.json(
        { error: 'Buyer ID and agreement text are required' },
        { status: 400 }
      )
    }

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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

    // Get client IP and user agent
    const ip_address = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown'
    const user_agent = request.headers.get('user-agent') || 'unknown'

    // Create the NDA agreement
    const { data: nda, error } = await supabase
      .from('nda_agreements')
      .insert({
        buyer_id: body.buyer_id,
        agreement_version: body.agreement_version || '1.0',
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

    // Update the buyer's NDA status
    const { error: updateError } = await supabase
      .from('master_buyers')
      .update({
        nda_signed: true,
        nda_signed_date: new Date().toISOString(),
        nda_ip_address: ip_address,
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