import { createClient } from '@supabase/supabase-js'

// Singleton pattern for Supabase client
let supabaseInstance: ReturnType<typeof createClient> | null = null

// Create client with anon key for normal operations (respects RLS)
export function createSupabaseClient() {
  // In browser environment, these should be available as NEXT_PUBLIC_ variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Provide a more helpful error message
    if (typeof window !== 'undefined') {
      console.error('❌ [SUPABASE] Environment variables missing in browser:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
        env: process.env.NODE_ENV
      })
      throw new Error('Supabase configuration missing. Please check environment variables.')
    } else {
      throw new Error('Supabase environment variables not configured')
    }
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  }
  return supabaseInstance
}

// Create admin client with service role key (ONLY for admin operations)
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
      // Return dummy client for build-time execution
      return {
        from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }),
        rpc: () => ({ data: null, error: null }),
        auth: { getUser: () => ({ data: { user: null }, error: null }) },
      } as any
    }
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Get the singleton instance
export function getSupabaseClient() {
  return createSupabaseClient()
}

// Get admin client for privileged operations
export function getAdminSupabaseClient() {
  return createAdminSupabaseClient()
}

// Backward compatibility export - lazy-loaded
export function getSupabase() {
  return createSupabaseClient()
}

// Utility function for making authenticated API calls
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  try {
    const supabase = createSupabaseClient()
    const session = await supabase.auth.getSession()
    
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    }

    // Only set Content-Type to application/json if not already set and not FormData
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    // Add authorization header if we have a session
    if (session.data.session?.access_token) {
      headers['Authorization'] = `Bearer ${session.data.session.access_token}`
    }

    // Add role session token if available (for role switching)
    if (typeof window !== 'undefined') {
      const roleSessionToken = localStorage.getItem('roleSessionToken')
      if (roleSessionToken) {
        headers['x-role-session-token'] = roleSessionToken
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })
    
    return response
  } catch (error) {
    console.error('❌ authenticatedFetch: Error:', error)
    throw error
  }
}

// Database types for TypeScript
export interface MasterAgency {
  id: string
  name: string
  code: string
  instance_id: string
  instance_url: string
  instance_anon_key: string
  instance_service_key: string
  contact_name?: string
  contact_email: string
  contact_phone?: string
  address?: string
  address_line2?: string
  city?: string
  state?: string
  zipcode?: string
  subscription_tier: 'basic' | 'professional' | 'enterprise'
  subscription_status: 'active' | 'suspended' | 'cancelled' | 'pending'
  subscription_start_date: string
  subscription_end_date?: string
  billing_cycle: 'monthly' | 'quarterly' | 'annual'
  base_monthly_fee: number
  max_users: number
  max_portfolios: number
  max_debt_accounts: number
  storage_limit_gb: number
  features_enabled: {
    api_access: boolean
    custom_domain: boolean
    advanced_analytics: boolean
    white_label: boolean
    vonage_integration: boolean
    dropco_integration: boolean
    tcn_integration: boolean
    tlo_integration: boolean
    experian_integration: boolean
  }
  pci_dss_compliant: boolean
  compliance_audit_date?: string
  data_retention_days: number
  security_settings: {
    mfa_required: boolean
    session_timeout_minutes: number
    ip_whitelist: string[]
    audit_logging: boolean
  }
  status: 'active' | 'inactive' | 'suspended' | 'provisioning'
  onboarding_stage: 'pending' | 'setup' | 'training' | 'active'

  notes?: string
  created_at: string
  updated_at: string
  last_activity_at?: string
  last_billing_at?: string
}

export interface MasterClient {
  id: string
  name: string
  code: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  address_line2?: string
  city?: string
  state?: string
  zipcode?: string
  client_type: 'creditor' | 'debt_buyer' | 'servicer'
  industry?: string
  website?: string
  tax_id?: string
  dba_name?: string
  fdpa_license_number?: string
  state_licenses: Record<string, any>
  compliance_contact_name?: string
  compliance_contact_email?: string
  compliance_contact_phone?: string
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
  updated_at: string
}

export interface MasterPortfolio {
  id: string
  name: string
  description?: string
  client_id: string
  agency_id: string
  ownership_type: 'owned' | 'platform_client' | 'agency_private_client'
  portfolio_type: 'credit_card' | 'medical' | 'personal_loan' | 'auto_loan' | 'mortgage' | 'utility' | 'other'
  original_balance: number
  account_count: number
  charge_off_date?: string
  debt_age_months?: number
  average_balance?: number
  geographic_focus?: string[]
  credit_score_range?: string
  placement_terms?: {
    contingency_rate?: number
    flat_fee_per_account?: number
    minimum_collection_amount?: number
    collection_period_months?: number
  }
  platform_fee_percentage?: number
  status: 'active' | 'inactive' | 'completed' | 'returned'
  created_at: string
  updated_at: string
}

export interface AgencyUsage {
  id: string
  agency_id: string
  date: string
  storage_gb: number
  compute_hours: number
  api_calls: number
  bandwidth_gb: number
  active_users: number
  total_debt_accounts: number
  total_portfolios: number
  total_clients: number
  total_collected: number
  resolved_accounts: number
  active_calls: number
  created_at: string
  updated_at: string
}

export interface AgencyBilling {
  id: string
  agency_id: string
  billing_period: string
  invoice_number?: string
  base_fee: number
  storage_fee: number
  compute_fee: number
  api_fee: number
  bandwidth_fee: number
  overage_fee: number
  subtotal: number
  tax_amount: number
  total_amount: number
  status: 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  payment_method?: string
  payment_date?: string
  payment_reference?: string
  created_at: string
  updated_at: string
  due_date?: string
} 