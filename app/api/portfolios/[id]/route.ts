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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
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
    if (user.activeRole.roleType !== 'platform_admin') {
      // Check if user is the portfolio owner (client admin)
      if (user.activeRole.organizationType !== 'client' || 
          user.activeRole.organizationId !== portfolio.client_id) {
        return NextResponse.json(
          { error: 'Insufficient permissions. Only platform admins or portfolio owners can update portfolios.' },
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

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only platform admins can delete portfolios.' },
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
      .from('debt_accounts')
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

    // If there are debt accounts in this portfolio, clean them up properly
    if (portfolio) {
      // 1. Delete all debt accounts from this portfolio
      const { error: debtAccountsDeleteError } = await supabase
        .from('debt_accounts')
        .delete()
        .eq('portfolio_id', params.id)

      if (debtAccountsDeleteError) {
        console.error('Error deleting debt accounts:', debtAccountsDeleteError)
        return NextResponse.json(
          { error: 'Failed to delete debt accounts' },
          { status: 500 }
        )
      }

      // 2. Delete persons ONLY if they have no remaining debt accounts and no payments
      // Get all person IDs that are still referenced by other debt accounts
      const { data: remainingDebtAccounts } = await supabase
        .from('debt_accounts')
        .select('person_id')
        .not('person_id', 'is', null)

      const remainingPersonIds = remainingDebtAccounts?.map(d => d.person_id) || []
      const orphanedPersonIds = personIds.filter(id => !remainingPersonIds.includes(id))

      if (orphanedPersonIds.length > 0) {
        // Check if any of these persons have payments through their debt accounts
        const { data: paymentDebtors } = await supabase
          .from('debtor_payments')
          .select('debtor_id')
          .in('debtor_id', debtorIdArray)

        const paymentDebtorIds = paymentDebtors?.map(p => p.debtor_id) || []
        const debtorsWithPayments = debtorIds.filter(d => paymentDebtorIds.includes(d.id))
        const personIdsWithPayments = debtorsWithPayments.map(d => d.person_id).filter(id => id !== null)
        const trulyOrphanedPersonIds = orphanedPersonIds.filter(id => !personIdsWithPayments.includes(id))

        if (trulyOrphanedPersonIds.length > 0) {
          await supabase
            .from('persons')
            .delete()
            .in('id', trulyOrphanedPersonIds)
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