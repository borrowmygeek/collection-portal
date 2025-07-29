import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logSecurityEvent, AUDIT_ACTIONS } from '@/lib/audit-log'
import { extractPhoneFromVonageWebhook, getPhoneNumberVariations, formatPhoneNumber } from '@/lib/phone-utils'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

// Only create client if environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Vonage webhook secret for verification (optional but recommended)
const VONAGE_WEBHOOK_SECRET = process.env.VONAGE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    // Get the raw body for signature verification
    const body = await request.text()
    
    // Log the incoming webhook
    console.log('Vonage webhook received:', body)
    
    // Verify webhook signature if secret is configured
    if (VONAGE_WEBHOOK_SECRET) {
      const signature = request.headers.get('x-vonage-signature')
      if (!signature) {
        console.warn('No Vonage signature found in webhook')
        await logSecurityEvent(
          'unknown',
          AUDIT_ACTIONS.SECURITY_VIOLATION,
          { endpoint: '/api/webhooks/vonage', method: 'POST', error: 'No signature' },
          false,
          'Vonage webhook without signature',
          request
        )
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      
      // TODO: Implement signature verification
      // const isValid = verifyVonageSignature(body, signature, VONAGE_WEBHOOK_SECRET)
      // if (!isValid) {
      //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      // }
    }
    
    // Parse the webhook data
    const webhookData = new URLSearchParams(body)
    const phoneNumber = webhookData.get('PhoneNumber')
    
    if (!phoneNumber) {
      console.error('No PhoneNumber found in webhook data')
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/webhooks/vonage', method: 'POST', error: 'No PhoneNumber' },
        false,
        'Vonage webhook without PhoneNumber',
        request
      )
      return NextResponse.json(
        { error: 'PhoneNumber is required' },
        { status: 400 }
      )
    }
    
    // Extract and normalize phone number using utility function
    const normalizedPhone = extractPhoneFromVonageWebhook(body)
    
    if (!normalizedPhone) {
      console.error('Invalid phone number format:', phoneNumber)
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/webhooks/vonage', method: 'POST', error: 'Invalid phone format' },
        false,
        'Vonage webhook with invalid phone format',
        request
      )
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }
    
    console.log('Processing phone number:', normalizedPhone, 'Formatted:', formatPhoneNumber(normalizedPhone))
    
    // Get phone number variations for better search
    const phoneVariations = getPhoneNumberVariations(normalizedPhone)
    console.log('Searching for variations:', phoneVariations)
    
    // Search for debtors with this phone number or its variations
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_numbers')
      .select(`
        id,
        number,
        person_id,
        phone_type,
        is_current,
        is_verified,
        persons!inner(
          id,
          full_name,
          first_name,
          last_name,
          ssn
        ),
        debtors!inner(
          id,
          account_number,
          current_balance,
          collection_status,
          collection_priority,
          master_portfolios(name),
          master_clients(name)
        )
      `)
      .in('number', phoneVariations)
      .or(phoneVariations.map(p => `number.like.%${p}%`).join(','))
    
    if (phoneError) {
      console.error('Error searching phone numbers:', phoneError)
      await logSecurityEvent(
        'unknown',
        AUDIT_ACTIONS.SECURITY_VIOLATION,
        { endpoint: '/api/webhooks/vonage', method: 'POST', error: phoneError.message },
        false,
        'Database error in Vonage webhook',
        request
      )
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }
    
    // Log the webhook processing
    await logSecurityEvent(
      'system',
      AUDIT_ACTIONS.DATA_VIEW,
      { endpoint: '/api/webhooks/vonage', method: 'POST', phoneNumber: normalizedPhone },
      true,
      'Vonage webhook processed',
      request
    )
    
    // Return the found debtors
    const results = phoneNumbers?.map(pn => ({
      phone_number: pn.number,
      person: pn.persons,
      debtors: pn.debtors
    })) || []
    
    console.log(`Found ${results.length} matches for phone number ${normalizedPhone}`)
    
    return NextResponse.json({
      success: true,
      phone_number: normalizedPhone,
      matches: results.length,
      results
    })
    
  } catch (error) {
    console.error('Error processing Vonage webhook:', error)
    await logSecurityEvent(
      'unknown',
      AUDIT_ACTIONS.SECURITY_VIOLATION,
      { endpoint: '/api/webhooks/vonage', method: 'POST', error: error instanceof Error ? error.message : 'Unknown error' },
      false,
      'Vonage webhook processing error',
      request
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Vonage webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}