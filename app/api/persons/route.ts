import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification } from '@/lib/audit-log'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 20, 60000) // 20 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' }
        }
      )
    }

    // Check if user has permission to view persons
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const ssn = searchParams.get('ssn')
    const name = searchParams.get('name')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('persons')
      .select(`
        *,
        debt_accounts (
          id,
          account_number,
          original_account_number,
          current_balance,
          original_balance,
          status,
          collection_status,
          collection_priority,
          charge_off_date,
          last_payment_date,
          master_portfolios!debt_accounts_portfolio_id_fkey(
            id,
            name
          ),
          master_clients!debt_accounts_client_id_fkey(
            id,
            name,
            code
          )
        ),
        person_addresses (*),
        person_phones (*),
        person_emails (*)
      `)
      .range(offset, offset + limit - 1)

    if (ssn) {
      query = query.eq('ssn', ssn)
    }

    if (name) {
      query = query.or(`full_name.ilike.%${name}%,first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
    }

    const { data: persons, error } = await query

    if (error) {
      console.error('Error fetching persons:', error)
      return NextResponse.json({ error: 'Failed to fetch persons' }, { status: 500 })
    }

    // Log the data access
    await logDataAccess(
      user.auth_user_id,
      'PERSONS_VIEW',
      'persons',
      undefined,
      { 
        searchParams: { ssn, name, limit, offset },
        resultCount: persons?.length || 0 
      },
      request
    )

    return NextResponse.json({ persons })
  } catch (error) {
    console.error('Error in persons API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const rateLimitResult = await rateLimitByUser(user.auth_user_id, 10, 60000) // 10 requests per minute
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' }
        }
      )
    }

    // Check if user has permission to create persons
    const allowedRoles = ['platform_admin', 'agency_admin']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    const {
      ssn,
      first_name,
      middle_name,
      last_name,
      name_prefix,
      name_suffix,
      maiden_name,
      preferred_name,
      dob,
      gender,
      marital_status,
      occupation,
      employer,
      annual_income,
      credit_score,
      do_not_call,
      do_not_mail,
      do_not_email,
      do_not_text,
      bankruptcy_filed,
      active_military,
      addresses,
      phones,
      emails
    } = body

    // Create person record
    const { data: person, error: personError } = await supabase
      .from('persons')
      .insert({
        ssn,
        first_name,
        middle_name,
        last_name,
        name_prefix,
        name_suffix,
        maiden_name,
        preferred_name,
        full_name: `${first_name || ''} ${middle_name || ''} ${last_name || ''}`.trim(),
        dob,
        gender,
        marital_status,
        occupation,
        employer,
        annual_income,
        credit_score,
        do_not_call,
        do_not_mail,
        do_not_email,
        do_not_text,
        bankruptcy_filed,
        active_military
      })
      .select()
      .single()

    if (personError) {
      console.error('Error creating person:', personError)
      return NextResponse.json({ error: 'Failed to create person' }, { status: 500 })
    }

    // Create satellite data if provided
    if (addresses && addresses.length > 0) {
      const addressData = addresses.map((addr: any) => ({
        ...addr,
        person_id: person.id
      }))
      
      const { error: addressError } = await supabase
        .from('person_addresses')
        .insert(addressData)

      if (addressError) {
        console.error('Error creating addresses:', addressError)
      }
    }

    if (phones && phones.length > 0) {
      const phoneData = phones.map((phone: any) => ({
        ...phone,
        person_id: person.id
      }))
      
      const { error: phoneError } = await supabase
        .from('phone_numbers')
        .insert(phoneData)

      if (phoneError) {
        console.error('Error creating phones:', phoneError)
      }
    }

    if (emails && emails.length > 0) {
      const emailData = emails.map((email: any) => ({
        ...email,
        person_id: person.id
      }))
      
      const { error: emailError } = await supabase
        .from('emails')
        .insert(emailData)

      if (emailError) {
        console.error('Error creating emails:', emailError)
      }
    }

    // Log the data modification
    await logDataModification(
      user.auth_user_id,
      'PERSON_CREATE',
      'persons',
      person.id,
      {
        ssn,
        first_name,
        middle_name,
        last_name,
        name_prefix,
        name_suffix,
        maiden_name,
        preferred_name,
        dob,
        gender,
        marital_status,
        occupation,
        employer,
        annual_income,
        credit_score,
        do_not_call,
        do_not_mail,
        do_not_email,
        do_not_text,
        bankruptcy_filed,
        active_military
      },
      request
    )

    return NextResponse.json({ person }, { status: 201 })
  } catch (error) {
    console.error('Error in persons API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 