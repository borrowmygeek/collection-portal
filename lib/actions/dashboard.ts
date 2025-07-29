'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface DashboardStats {
  totalAgencies: number
  activeUsers: number
  monthlyRevenue: number
  platformHealth: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Get total agencies
    const { count: totalAgencies } = await supabase
      .from('master_agencies')
      .select('*', { count: 'exact', head: true })

    // Get active users (platform_users with active status)
    const { count: activeUsers } = await supabase
      .from('platform_users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Calculate monthly revenue from agency billing
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const { data: billingData } = await supabase
      .from('agency_billing')
      .select('total_amount')
      .eq('billing_period', currentMonth)
      .eq('status', 'paid')

    const monthlyRevenue = billingData?.reduce((sum, record) => sum + (record.total_amount || 0), 0) || 0

    // Platform health (simplified - could be more sophisticated)
    const platformHealth = 100 // Default to 100% - could calculate based on uptime, errors, etc.

    return {
      totalAgencies: totalAgencies || 0,
      activeUsers: activeUsers || 0,
      monthlyRevenue,
      platformHealth
    }

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      totalAgencies: 0,
      activeUsers: 0,
      monthlyRevenue: 0,
      platformHealth: 100
    }
  }
} 