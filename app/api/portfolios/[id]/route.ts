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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseClient()
    
    const { data: portfolio, error } = await supabase
      .from('master_portfolios')
      .select(`
        *,
        client:master_clients(
          id,
          name,
          status
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching portfolio:', error)
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(portfolio)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseClient()
    const body = await request.json()

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to update this portfolio
    const { data: portfolio } = await supabase
      .from('master_portfolios')
      .select('client_id')
      .eq('id', params.id)
      .single()

    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }

    // Check if user is platform admin or portfolio owner
    const { data: userProfile } = await supabase
      .from('auth.users')
      .select('raw_user_meta_data')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.raw_user_meta_data?.role === 'platform_admin'
    
    if (!isAdmin) {
      // Check if user is the portfolio owner
      const { data: client } = await supabase
        .from('master_clients')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', portfolio.client_id)
        .single()

      if (!client) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Get the current portfolio to check if name is being changed
    const { data: currentPortfolio } = await supabase
      .from('master_portfolios')
      .select('name, client_id')
      .eq('id', params.id)
      .single()

    if (!currentPortfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }

    // Check if name is being changed and if it conflicts with existing portfolio
    if (body.name && body.name !== currentPortfolio.name) {
      const { data: existingPortfolio } = await supabase
        .from('master_portfolios')
        .select('id, name')
        .eq('client_id', currentPortfolio.client_id)
        .eq('name', body.name)
        .neq('id', params.id)
        .single()

      if (existingPortfolio) {
        return NextResponse.json(
          { error: `A portfolio with the name "${body.name}" already exists for this client` },
          { status: 400 }
        )
      }
    }

    // Update the portfolio
    const { data: updatedPortfolio, error } = await supabase
      .from('master_portfolios')
      .update({
        name: body.name,
        description: body.description,
        status: body.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select(`
        *,
        client:master_clients(
          id,
          name,
          status
        )
      `)
      .single()

    if (error) {
      console.error('Error updating portfolio:', error)
      return NextResponse.json(
        { error: 'Failed to update portfolio' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedPortfolio)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseClient()
    
    // Get current user from authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is platform admin
    const { data: userProfile } = await supabase
      .from('auth.users')
      .select('raw_user_meta_data')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.raw_user_meta_data?.role === 'platform_admin'
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get portfolio details for confirmation message
    const { data: portfolio, error: portfolioError } = await supabase
      .from('master_portfolios')
      .select('name')
      .eq('id', params.id)
      .single()

    if (portfolioError || !portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }

    // Get all debtor IDs for this portfolio
    const { data: debtorIds, error: debtorIdsError } = await supabase
      .from('debtors')
      .select('id, person_id')
      .eq('portfolio_id', params.id)

    if (debtorIdsError) {
      console.error('Error fetching debtor IDs:', debtorIdsError)
      return NextResponse.json(
        { error: 'Failed to fetch debtor IDs' },
        { status: 500 }
      )
    }

    const debtorIdArray = debtorIds.map(d => d.id)
    const personIds = debtorIds.map(d => d.person_id).filter(id => id !== null)

    // If there are debtors in this portfolio, clean them up properly
    if (debtorIdArray.length > 0) {
      // 1. Delete all debtors from this portfolio
      const { error: debtorsDeleteError } = await supabase
        .from('debtors')
        .delete()
        .eq('portfolio_id', params.id)

      if (debtorsDeleteError) {
        console.error('Error deleting debtors:', debtorsDeleteError)
        return NextResponse.json(
          { error: 'Failed to delete debtors' },
          { status: 500 }
        )
      }

      // 2. Delete persons ONLY if they have no remaining debtors and no payments
      if (personIds.length > 0) {
        // Get all person IDs that are still referenced by other debtors
        const { data: remainingPersons } = await supabase
          .from('debtors')
          .select('person_id')
          .not('person_id', 'is', null)

        const remainingPersonIds = remainingPersons?.map(d => d.person_id) || []
        const orphanedPersonIds = personIds.filter(id => !remainingPersonIds.includes(id))

        if (orphanedPersonIds.length > 0) {
          // Check if any of these persons have payments
          const { data: paymentPersons } = await supabase
            .from('payments')
            .select('person_id')
            .in('person_id', orphanedPersonIds)

          const paymentPersonIds = paymentPersons?.map(p => p.person_id) || []
          const trulyOrphanedPersonIds = orphanedPersonIds.filter(id => !paymentPersonIds.includes(id))

          if (trulyOrphanedPersonIds.length > 0) {
            await supabase
              .from('persons')
              .delete()
              .in('id', trulyOrphanedPersonIds)
          }
        }
      }
    }

    // 6. Delete all import jobs for this portfolio
    const { error: importJobsDeleteError } = await supabase
      .from('import_jobs')
      .delete()
      .eq('portfolio_id', params.id)

    if (importJobsDeleteError) {
      console.error('Error deleting import jobs:', importJobsDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete import jobs' },
        { status: 500 }
      )
    }

    // 7. Delete the portfolio
    const { error } = await supabase
      .from('master_portfolios')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting portfolio:', error)
      return NextResponse.json(
        { error: 'Failed to delete portfolio' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully deleted portfolio "${portfolio.name}" with all associated data`
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 