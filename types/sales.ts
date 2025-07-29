// Sales Module Types
// Collection Portal - Portfolio Sales Feature

export interface MasterBuyer {
  id: string
  user_id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  website?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip_code?: string
  country: string
  nda_signed: boolean
  nda_signed_date?: string
  nda_ip_address?: string
  status: 'pending' | 'approved' | 'suspended' | 'inactive'
  verification_notes?: string
  created_at: string
  updated_at: string
}

export interface NDAAgreement {
  id: string
  buyer_id: string
  agreement_version: string
  agreement_text: string
  ip_address?: string
  user_agent?: string
  signed_at: string
  expires_at?: string
  status: 'active' | 'expired' | 'revoked'
}

export interface PortfolioSale {
  id: string
  portfolio_id: string
  client_id: string
  seller_id: string
  sale_status: 'available' | 'pending' | 'sold' | 'withdrawn'
  asking_price?: number
  minimum_offer?: number
  sale_notes?: string
  key_highlights?: string
  restrictions?: string
  due_diligence_package_url?: string
  created_at: string
  updated_at: string
  expires_at?: string
  created_by: string
  // Joined fields
  portfolio?: {
    id: string
    name: string
    description?: string
    status: string
  }
  client?: {
    id: string
    name: string
    status: string
  }
  seller?: {
    id: string
    name: string
    status: string
  }
  stats?: PortfolioSaleStats
}

export interface PortfolioSaleStats {
  id: string
  portfolio_sale_id: string
  total_accounts: number
  total_balance: number
  average_balance: number
  average_charge_off_date?: string
  average_debt_age_months?: number
  average_credit_score?: number
  state_distribution?: Record<string, number>
  client_distribution?: Record<string, number>
  account_type_distribution?: Record<string, number>
  balance_range_distribution?: Record<string, number>
  charge_off_date_distribution?: Record<string, number>
  last_updated: string
}

export interface SaleView {
  id: string
  portfolio_sale_id: string
  buyer_id: string
  viewed_at: string
  ip_address?: string
  user_agent?: string
}

export interface SaleInquiry {
  id: string
  portfolio_sale_id: string
  buyer_id: string
  inquiry_type: 'question' | 'offer' | 'nda_request' | 'due_diligence'
  message: string
  contact_preference: string
  status: 'pending' | 'responded' | 'closed'
  created_at: string
  responded_at?: string
  responded_by?: string
  // Joined fields
  portfolio_sale?: PortfolioSale
  buyer?: MasterBuyer
}

export interface SalesDashboardStats {
  total_available_portfolios: number
  total_portfolio_value: number
  average_portfolio_size: number
  total_buyers: number
  active_buyers: number
  total_inquiries: number
  pending_inquiries: number
}

export interface PortfolioSaleFilters {
  min_balance?: number
  max_balance?: number
  states?: string[]
  account_types?: string[]
  debt_age_min?: number
  debt_age_max?: number
  charge_off_date_from?: string
  charge_off_date_to?: string
}

export interface NDATemplate {
  id: string
  version: string
  title: string
  content: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Form types for creating/editing
export interface CreateBuyerForm {
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  website?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
}

export interface CreatePortfolioSaleForm {
  portfolio_id: string
  asking_price?: number
  minimum_offer?: number
  sale_notes?: string
  key_highlights?: string
  restrictions?: string
  expires_at?: string
}

export interface CreateInquiryForm {
  portfolio_sale_id: string
  inquiry_type: 'question' | 'offer' | 'nda_request' | 'due_diligence'
  message: string
  contact_preference: string
}

// API Response types
export interface SalesAPIResponse<T> {
  data: T
  error?: string
  message?: string
}

export interface SalesListResponse {
  sales: PortfolioSale[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface SalesStatsResponse {
  stats: SalesDashboardStats
  recent_sales: PortfolioSale[]
  top_buyers: MasterBuyer[]
} 