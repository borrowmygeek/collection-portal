import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const portfolioId = params.id

    // Get portfolio details
    const { data: portfolio, error: portfolioError } = await supabase
      .from('master_portfolios')
      .select('*')
      .eq('id', portfolioId)
      .single()

    if (portfolioError || !portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }

    // Get debtor statistics for this portfolio
    const { data: debtAccounts, error: debtAccountsError } = await supabase
      .from('debt_accounts')
      .select(`
        id,
        current_balance,
        original_balance,
        status,
        collection_status,
        collection_priority,
        total_payments,
        payment_count,
        last_payment_date,
        charge_off_date,
        created_at
      `)
      .eq('portfolio_id', portfolioId)

    if (debtAccountsError) {
      console.error('Error fetching debt accounts:', debtAccountsError)
      return NextResponse.json(
        { error: 'Failed to fetch portfolio statistics' },
        { status: 500 }
      )
    }

    // Calculate statistics
    const totalAccounts = debtAccounts?.length || 0
    const totalOriginalBalance = debtAccounts?.reduce((sum, debtAccount) => sum + (debtAccount.original_balance || 0), 0) || 0
    const totalCurrentBalance = debtAccounts?.reduce((sum, debtAccount) => sum + (debtAccount.current_balance || 0), 0) || 0
    const totalCollected = totalOriginalBalance - totalCurrentBalance
    const collectionRate = totalOriginalBalance > 0 ? (totalCollected / totalOriginalBalance) * 100 : 0

    // Status breakdown
    const statusBreakdown = debtAccounts?.reduce((acc, debtAccount) => {
      const status = debtAccount.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Priority breakdown
    const priorityBreakdown = debtAccounts?.reduce((acc, debtAccount) => {
      const priority = debtAccount.collection_priority || 'normal'
      acc[priority] = (acc[priority] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Payment statistics
    const totalPayments = debtAccounts?.reduce((sum, debtAccount) => sum + (debtAccount.total_payments || 0), 0) || 0
    const paymentCount = debtAccounts?.reduce((sum, debtAccount) => sum + (debtAccount.payment_count || 0), 0) || 0
    const averagePayment = paymentCount > 0 ? totalPayments / paymentCount : 0

    // Recent activity
    const recentPayments = debtAccounts?.filter(debtAccount => 
      debtAccount.last_payment_date && 
      new Date(debtAccount.last_payment_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length || 0

    const stats = {
      portfolio,
      summary: {
        totalAccounts,
        totalOriginalBalance,
        totalCurrentBalance,
        totalCollected,
        collectionRate: Math.round(collectionRate * 100) / 100,
        totalPayments,
        paymentCount,
        averagePayment: Math.round(averagePayment * 100) / 100,
        recentPayments
      },
      breakdowns: {
        status: statusBreakdown,
        priority: priorityBreakdown
      }
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 