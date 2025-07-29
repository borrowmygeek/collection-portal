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
    const { data: debtors, error: debtorsError } = await supabase
      .from('debtors')
      .select(`
        id,
        original_balance,
        current_balance,
        collection_status,
        collection_priority,
        total_payments,
        payment_count,
        last_payment_amount,
        last_payment_date,
        assigned_collector_id
      `)
      .eq('portfolio_id', portfolioId)

    if (debtorsError) {
      console.error('Error fetching debtors:', debtorsError)
      return NextResponse.json(
        { error: 'Failed to fetch debtor statistics' },
        { status: 500 }
      )
    }

    // Calculate statistics
    const totalAccounts = debtors?.length || 0
    const totalOriginalBalance = debtors?.reduce((sum, debtor) => sum + (debtor.original_balance || 0), 0) || 0
    const totalCurrentBalance = debtors?.reduce((sum, debtor) => sum + (debtor.current_balance || 0), 0) || 0
    const totalCollected = totalOriginalBalance - totalCurrentBalance
    const collectionRate = totalOriginalBalance > 0 ? (totalCollected / totalOriginalBalance) * 100 : 0

    // Status breakdown
    const statusBreakdown = debtors?.reduce((acc, debtor) => {
      const status = debtor.collection_status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Priority breakdown
    const priorityBreakdown = debtors?.reduce((acc, debtor) => {
      const priority = debtor.collection_priority || 'unknown'
      acc[priority] = (acc[priority] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Payment statistics
    const totalPayments = debtors?.reduce((sum, debtor) => sum + (debtor.total_payments || 0), 0) || 0
    const paymentCount = debtors?.reduce((sum, debtor) => sum + (debtor.payment_count || 0), 0) || 0
    const averagePayment = paymentCount > 0 ? totalPayments / paymentCount : 0

    // Recent activity
    const recentPayments = debtors?.filter(debtor => 
      debtor.last_payment_date && 
      new Date(debtor.last_payment_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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