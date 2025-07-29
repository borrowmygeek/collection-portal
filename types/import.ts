// File Import Types

export interface ImportJob {
  id: string
  user_id: string
  file_name: string
  file_size: number
  file_type: 'csv' | 'xlsx' | 'xls'
  file_path: string | null
  import_type: 'portfolios' | 'accounts' | 'debtors' | 'clients' | 'agencies'
  template_id: string | null
  portfolio_id: string | null // Portfolio created by this import job
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  total_rows: number
  processed_rows: number
  successful_rows: number
  failed_rows: number
  errors: any[]
  created_at: string
  updated_at: string
  completed_at: string | null
  failed_rows_csv_path: string | null
}

export interface ImportError {
  row_number: number
  field: string
  message: string
  value?: string
}

export interface ImportTemplate {
  id: string
  name: string
  description: string | null
  import_type: 'portfolios' | 'accounts' | 'debtors' | 'clients' | 'agencies'
  field_mappings: any
  validation_rules: any
  created_at: string
  updated_at: string
}

export interface ValidationRule {
  field: string
  rule: 'required' | 'email' | 'phone' | 'ssn' | 'currency' | 'date' | 'enum'
  message: string
  options?: string[] // for enum validation
}

export interface ImportPreview {
  total_rows: number
  sample_rows: any[]
  headers: string[]
  file_type: string
  file_size: number
  validation_errors?: string[]
}

export interface ImportConfig {
  import_type: 'persons' | 'debtors' | 'clients' | 'agencies'
  template_id?: string
  column_mapping: Record<string, string>
  validation_rules: ValidationRule[]
}

// Person import row type
export interface PersonImportRow {
  ssn?: string
  first_name?: string
  middle_name?: string
  last_name?: string
  name_prefix?: string
  name_suffix?: string
  maiden_name?: string
  preferred_name?: string
  dob?: string
  gender?: string
  marital_status?: string
  occupation?: string
  employer?: string
  annual_income?: string
  credit_score?: string
  do_not_call?: string
  do_not_mail?: string
  do_not_email?: string
  do_not_text?: string
  bankruptcy_filed?: string
  active_military?: string
  // Address fields
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zipcode?: string
  county?: string
  country?: string
  // Phone fields
  phone_primary?: string
  phone_secondary?: string
  phone_work?: string
  // Email fields
  email_primary?: string
  email_secondary?: string
}

// Debtor import row type
export interface DebtorImportRow {
  // Person identification
  ssn?: string
  first_name?: string
  last_name?: string
  // Account information
  account_number?: string
  original_creditor?: string
  original_balance?: string
  current_balance?: string
  charge_off_date?: string
  date_opened?: string
  account_type?: string
  account_subtype?: string
  account_status?: string
  // Contact information
  phone_primary?: string
  phone_secondary?: string
  phone_work?: string
  email_primary?: string
  email_secondary?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zipcode?: string
  county?: string
  country?: string
  // Collection information
  collection_status?: string
  collection_priority?: string
  assigned_collector_email?: string
  // Compliance flags
  do_not_call?: string
  do_not_mail?: string
  do_not_email?: string
  do_not_text?: string
  bankruptcy_filed?: string
  active_military?: string
  hardship_declared?: string
  hardship_type?: string
  // Portfolio and client
  portfolio_name?: string
  client_name?: string
}

// Client import row type
export interface ClientImportRow {
  name: string
  code: string
  status?: string
}

// Agency import row type
export interface AgencyImportRow {
  name: string
  code: string
  status?: string
  subscription_status?: string
  subscription_plan?: string
}

// API response types
export interface ImportJobsResponse {
  jobs: ImportJob[]
  total: number
  page: number
  limit: number
}

export interface ImportTemplatesResponse {
  templates: ImportTemplate[]
  total: number
}

export interface ImportPreviewResponse {
  preview: ImportPreview
}

export interface ImportUploadResponse {
  job: ImportJob
  message: string
} 