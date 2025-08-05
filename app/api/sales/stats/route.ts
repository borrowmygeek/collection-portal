import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'

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
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to view sales stats
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user', 'buyer']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view sales statistics' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    
    // Get sales statistics - simplified query to avoid join issues
    const { data: salesStats, error: salesError } = await supabase
      .from('portfolio_sales')
      .select('id, asking_price')
      .eq('sale_status', 'available')

    if (salesError) {
      console.error('Error fetching sales stats:', salesError)
      // Return empty stats instead of error
      return NextResponse.json({
        stats: {
          total_available_portfolios: 0,
          total_portfolio_value: 0,
          average_portfolio_size: 0,
          total_buyers: 0,
          active_buyers: 0,
          total_inquiries: 0,
          pending_inquiries: 0
        }
      })
    }

    // Get buyer statistics
    const { data: buyerStats, error: buyerError } = await supabase
      .from('master_buyers')
      .select('id, status, nda_signed')

    if (buyerError) {
      console.error('Error fetching buyer stats:', buyerError)
      // Return empty stats instead of error
      return NextResponse.json({
        stats: {
          total_available_portfolios: salesStats?.length || 0,
          total_portfolio_value: 0,
          average_portfolio_size: 0,
          total_buyers: 0,
          active_buyers: 0,
          total_inquiries: 0,
          pending_inquiries: 0
        }
      })
    }

    // Get inquiry statistics
    const { data: inquiryStats, error: inquiryError } = await supabase
      .from('sale_inquiries')
      .select('id, status')

    if (inquiryError) {
      console.error('Error fetching inquiry stats:', inquiryError)
      // Continue with empty inquiry stats
    }

    // Calculate statistics
    const totalAvailablePortfolios = salesStats?.length || 0
    const totalPortfolioValue = salesStats?.reduce((sum, sale) => {
      return sum + (sale.asking_price || 0)
    }, 0) || 0
    const averagePortfolioSize = totalAvailablePortfolios > 0 ? totalPortfolioValue / totalAvailablePortfolios : 0
    
    const totalBuyers = buyerStats?.length || 0
    const activeBuyers = buyerStats?.filter(buyer => 
      buyer.status === 'approved' && buyer.nda_signed
    ).length || 0
    
    const totalInquiries = inquiryStats?.length || 0
    const pendingInquiries = inquiryStats?.filter(inquiry => 
      inquiry.status === 'pending'
    ).length || 0

    const stats = {
      total_available_portfolios: totalAvailablePortfolios,
      total_portfolio_value: totalPortfolioValue,
      average_portfolio_size: averagePortfolioSize,
      total_buyers: totalBuyers,
      active_buyers: activeBuyers,
      total_inquiries: totalInquiries,
      pending_inquiries: pendingInquiries
    }

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 