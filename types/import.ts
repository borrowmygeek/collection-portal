// File Import Types

export interface ImportJob {
  id: string
  file_name: string
  file_path: string | null
  file_size: number
  file_type: string
  import_type: 'portfolios' | 'accounts' | 'debt_accounts' | 'clients' | 'agencies' | 'skip_trace'
  portfolio_id: string | null
  template_id: string | null
  user_id: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number | null
  total_rows: number | null
  processed_rows: number | null
  successful_rows: number | null
  failed_rows: number | null
  errors: any | null
  failed_rows_csv_path: string | null
  created_at: string | null
  updated_at: string | null
  completed_at: string | null
}

export interface ImportJobCreate {
  file_name: string
  file_path: string | null
  file_size: number
  file_type: string
  import_type: 'portfolios' | 'accounts' | 'debt_accounts' | 'clients' | 'agencies' | 'skip_trace'
  portfolio_id?: string | null
  template_id?: string | null
  user_id?: string | null
}

export interface ImportJobUpdate {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress?: number | null
  total_rows?: number | null
  processed_rows?: number | null
  successful_rows?: number | null
  failed_rows?: number | null
  errors?: any | null
  failed_rows_csv_path?: string | null
  completed_at?: string | null
}

export interface ImportTemplate {
  id: string
  name: string
  description: string | null
  import_type: 'persons' | 'debt_accounts' | 'clients' | 'agencies' | 'skip_trace'
  required_columns: string[]
  optional_columns: string[] | null
  field_mappings: any | null
  validation_rules: any | null
  sample_data: any | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ImportTemplateCreate {
  name: string
  description?: string | null
  import_type: 'persons' | 'debt_accounts' | 'clients' | 'agencies' | 'skip_trace'
  required_columns: string[]
  optional_columns?: string[] | null
  field_mappings?: any | null
  validation_rules?: any | null
  sample_data?: any | null
  created_by?: string | null
}

export interface ImportTemplateUpdate {
  name?: string
  description?: string | null
  import_type?: 'persons' | 'debt_accounts' | 'clients' | 'agencies' | 'skip_trace'
  required_columns?: string[]
  optional_columns?: string[] | null
  field_mappings?: any | null
  validation_rules?: any | null
  sample_data?: any | null
}

export interface ImportError {
  row_number: number
  field: string
  message: string
  value?: string
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
  import_type: 'persons' | 'debtors' | 'clients' | 'agencies' | 'skip_trace'
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

// Skip Trace import row type
export interface SkipTraceImportRow {
  // Input fields
  account_key?: string
  ssn?: string
  last_name?: string
  first_name?: string
  address_1?: string
  city?: string
  state?: string
  zip_code?: string
  scrub_date?: string
  
  // Deceased information
  deceased?: string
  idi_first_name?: string
  idi_middle_name?: string
  idi_last_name?: string
  residence_zip?: string
  last_payment_zip?: string
  deceased_city?: string
  deceased_state?: string
  verified_proof?: string
  ssdi_first_name?: string
  ssdi_middle_name?: string
  ssdi_last_name?: string
  ssdi_date_of_dec?: string
  obit_first_name?: string
  obit_middle_name?: string
  obit_last_name?: string
  obit_date_of_dec?: string
  
  // Bankruptcy information
  bankrupt?: string
  bankruptcy_state?: string
  case_number?: string
  filing_year?: string
  filing_date?: string
  chapter?: string
  internal_court_number?: string
  debtor_type?: string
  bankruptcy_ssn?: string
  bankruptcy_first_name?: string
  bankruptcy_middle_name?: string
  bankruptcy_last_name?: string
  generation?: string
  link_code?: string
  address_full?: string
  street_number?: string
  street_direction?: string
  street_name?: string
  street_type?: string
  address?: string
  bankruptcy_city?: string
  bankruptcy_state_2?: string
  bankruptcy_zip?: string
  codebtor_first_name?: string
  codebtor_middle_name?: string
  codebtor_last_name?: string
  codebtor_generation?: string
  codebtor_address?: string
  codebtor_city?: string
  codebtor_state?: string
  codebtor_zip?: string
  discharged_date?: string
  dismissed_date?: string
  closed_date?: string
  hearing_date?: string
  assets?: string
  debtor_key?: string
  case_voluntary?: string
  trustee_name?: string
  trustee_address?: string
  trustee_city?: string
  trustee_state?: string
  trustee_zip?: string
  trustee_phone?: string
  hearing_time?: string
  hearing_address1?: string
  hearing_address2?: string
  hearing_city?: string
  hearing_state?: string
  hearing_zip?: string
  judge_name?: string
  judge_initials?: string
  individual_join?: string
  prev_ch_number?: string
  chapter_conversion_date?: string
  proof_of_claim_date?: string
  objection_to_plan_date?: string
  attorney_name?: string
  attorney_firm_name?: string
  attorney_address1?: string
  attorney_address2?: string
  attorney_city?: string
  attorney_state?: string
  attorney_zip?: string
  attorney_phone?: string
  court_district?: string
  court_venue?: string
  court_address1?: string
  court_address2?: string
  court_city?: string
  court_state?: string
  court_zip?: string
  court_phone?: string
  reinstated?: string
  reinstate_date?: string
  disposition_status?: string
  
  // Address information
  address_hit?: string
  address1?: string
  address1_city?: string
  address1_state?: string
  address1_zip?: string
  address1_county?: string
  address1_first_seen?: string
  address1_last_seen?: string
  
  // Phone information
  phone_hit?: string
  phone1?: string
  phone1_type?: string
  phone1_first_seen?: string
  phone1_last_seen?: string
  phone2?: string
  phone2_type?: string
  phone2_first_seen?: string
  phone2_last_seen?: string
  phone3?: string
  phone3_type?: string
  phone3_first_seen?: string
  phone3_last_seen?: string
  
  // Property information
  property_hit?: string
  parcel_id_number?: string
  pid?: string
  property_first_name?: string
  property_middle_initial?: string
  property_last_name?: string
  owner2_first_name?: string
  owner2_middle_initial?: string
  owner2_last_name?: string
  spouse_first_name?: string
  spouse_middle_name?: string
  spouse_last_name?: string
  property_address_full?: string
  property_address_number?: string
  property_address_directional?: string
  property_street?: string
  property_street_suffix?: string
  property_post_directional?: string
  property_unit_designator?: string
  property_unit_number?: string
  property_city?: string
  property_state?: string
  property_zip?: string
  property_county?: string
  property_mail_address_full?: string
  property_mail_address_number?: string
  property_mail_address_directional?: string
  property_mail_street?: string
  property_mail_street_suffix?: string
  property_mail_post_directional?: string
  property_mail_unit_designator?: string
  property_mail_unit_number?: string
  property_mail_city?: string
  property_mail_state?: string
  property_mail_zip?: string
  loan_amount_1?: string
  lender_1?: string
  lender_type_1?: string
  loan_amount_2?: string
  lender_2?: string
  lender_type_2?: string
  loan_amount_3?: string
  lender_3?: string
  lender_type_3?: string
  purchase_amount?: string
  purchase_date?: string
  assessed_date?: string
  property_filing_date?: string
  lot_size?: string
  assessed_value?: string
  market_value?: string
  square_feet?: string
  
  // Additional properties (Prop2, Prop3)
  prop2_parcel_id_number?: string
  prop2_first_name?: string
  prop2_middle_initial?: string
  prop2_last_name?: string
  prop2_owner2_first_name?: string
  prop2_owner2_middle_initial?: string
  prop2_owner2_last_name?: string
  prop2_spouse_first_name?: string
  prop2_spouse_middle_name?: string
  prop2_spouse_last_name?: string
  prop2_address_full?: string
  prop2_address_number?: string
  prop2_address_directional?: string
  prop2_street?: string
  prop2_street_suffix?: string
  prop2_post_directional?: string
  prop2_unit_designator?: string
  prop2_unit_number?: string
  prop2_city?: string
  prop2_state?: string
  prop2_zip?: string
  prop2_county?: string
  prop2_mail_address_full?: string
  prop2_mail_address_number?: string
  prop2_mail_address_directional?: string
  prop2_mail_street?: string
  prop2_mail_street_suffix?: string
  prop2_mail_post_directional?: string
  prop2_mail_unit_designator?: string
  prop2_mail_unit_number?: string
  prop2_mail_city?: string
  prop2_mail_state?: string
  prop2_mail_zip?: string
  prop2_loan_amount_1?: string
  prop2_lender_1?: string
  prop2_lender_type_1?: string
  prop2_loan_amount_2?: string
  prop2_lender_2?: string
  prop2_lender_type_2?: string
  prop2_loan_amount_3?: string
  prop2_lender_3?: string
  prop2_lender_type_3?: string
  prop2_purchase_amount?: string
  prop2_purchase_date?: string
  prop2_assessed_date?: string
  prop2_filing_date?: string
  prop2_lot_size?: string
  prop2_assessed_value?: string
  prop2_market_value?: string
  prop2_square_feet?: string
  
  prop3_parcel_id_number?: string
  prop3_first_name?: string
  prop3_middle_initial?: string
  prop3_last_name?: string
  prop3_owner2_first_name?: string
  prop3_owner2_middle_initial?: string
  prop3_owner2_last_name?: string
  prop3_spouse_first_name?: string
  prop3_spouse_middle_name?: string
  prop3_spouse_last_name?: string
  prop3_address_full?: string
  prop3_address_number?: string
  prop3_address_directional?: string
  prop3_street?: string
  prop3_street_suffix?: string
  prop3_post_directional?: string
  prop3_unit_designator?: string
  prop3_unit_number?: string
  prop3_city?: string
  prop3_state?: string
  prop3_zip?: string
  prop3_county?: string
  prop3_mail_address_full?: string
  prop3_mail_address_number?: string
  prop3_mail_address_directional?: string
  prop3_mail_street?: string
  prop3_mail_street_suffix?: string
  prop3_mail_post_directional?: string
  prop3_mail_unit_designator?: string
  prop3_mail_unit_number?: string
  prop3_mail_city?: string
  prop3_mail_state?: string
  prop3_mail_zip?: string
  prop3_loan_amount_1?: string
  prop3_lender_1?: string
  prop3_lender_type_1?: string
  prop3_loan_amount_2?: string
  prop3_lender_2?: string
  prop3_lender_type_2?: string
  prop3_loan_amount_3?: string
  prop3_lender_3?: string
  prop3_lender_type_3?: string
  prop3_purchase_amount?: string
  prop3_purchase_date?: string
  prop3_assessed_date?: string
  prop3_filing_date?: string
  prop3_lot_size?: string
  prop3_assessed_value?: string
  prop3_market_value?: string
  prop3_square_feet?: string
  
  // Relatives information
  relatives_hit?: string
  rel1_first_name?: string
  rel1_middle_name?: string
  rel1_last_name?: string
  rel1_suffix?: string
  rel1_full_name?: string
  rel1_address?: string
  rel1_city?: string
  rel1_state?: string
  rel1_zip?: string
  rel1_age?: string
  rel1_phone_1?: string
  rel1_phone_2?: string
  rel1_phone_3?: string
  rel1_email_1?: string
  rel1_email_2?: string
  rel1_email_3?: string
  rel1_likely_relationship?: string
  
  rel2_first_name?: string
  rel2_middle_name?: string
  rel2_last_name?: string
  rel2_suffix?: string
  rel2_full_name?: string
  rel2_address?: string
  rel2_city?: string
  rel2_state?: string
  rel2_zip?: string
  rel2_age?: string
  rel2_phone_1?: string
  rel2_phone_2?: string
  rel2_phone_3?: string
  rel2_email_1?: string
  rel2_email_2?: string
  rel2_email_3?: string
  rel2_likely_relationship?: string
  
  rel3_first_name?: string
  rel3_middle_name?: string
  rel3_last_name?: string
  rel3_suffix?: string
  rel3_full_name?: string
  rel3_address?: string
  rel3_city?: string
  rel3_state?: string
  rel3_zip?: string
  rel3_age?: string
  rel3_phone_1?: string
  rel3_phone_2?: string
  rel3_phone_3?: string
  rel3_email_1?: string
  rel3_email_2?: string
  rel3_email_3?: string
  rel3_likely_relationship?: string
  
  rel4_first_name?: string
  rel4_middle_name?: string
  rel4_last_name?: string
  rel4_suffix?: string
  rel4_full_name?: string
  rel4_address?: string
  rel4_city?: string
  rel4_state?: string
  rel4_zip?: string
  rel4_age?: string
  rel4_phone_1?: string
  rel4_phone_2?: string
  rel4_phone_3?: string
  rel4_email_1?: string
  rel4_email_2?: string
  rel4_email_3?: string
  rel4_likely_relationship?: string
  
  rel5_first_name?: string
  rel5_middle_name?: string
  rel5_last_name?: string
  rel5_suffix?: string
  rel5_full_name?: string
  rel5_address?: string
  rel5_city?: string
  rel5_state?: string
  rel5_zip?: string
  rel5_age?: string
  rel5_phone_1?: string
  rel5_phone_2?: string
  rel5_phone_3?: string
  rel5_email_1?: string
  rel5_email_2?: string
  rel5_email_3?: string
  rel5_likely_relationship?: string
  
  // Vehicle information
  vehicle_hit?: string
  vehicle_make?: string
  vehicle_model?: string
  vehicle_model_year?: string
  vehicle_trim?: string
  vehicle_vin?: string
  vehicle_squished_vin?: string
  vehicle_axles?: string
  vehicle_type?: string
  vehicle_body_style?: string
  vehicle_primary_color?: string
  vehicle_secondary_color?: string
  vehicle_weight?: string
  vehicle_length?: string
  vehicle_registrant_name?: string
  vehicle_registrant_business_name?: string
  vehicle_registrant_address?: string
  vehicle_registrant_mail_address?: string
  vehicle_registrant_latest_address?: string
  vehicle_owner_name?: string
  vehicle_owner_dob?: string
  vehicle_owner_business_name?: string
  vehicle_owner_address?: string
  vehicle_owner_mail_address?: string
  vehicle_owner_latest_address?: string
  vehicle_lien_holder_name?: string
  vehicle_lien_business_name?: string
  vehicle_lien_holder_address?: string
  vehicle_lien_holder_mail_address?: string
  vehicle_lien_holder_latest_address?: string
  vehicle_lessor_name?: string
  vehicle_lessor_business_name?: string
  vehicle_lessor_address?: string
  vehicle_lessor_mail_address?: string
  vehicle_lessor_latest_address?: string
  vehicle_plate_number?: string
  vehicle_plate_state?: string
  vehicle_plate_type?: string
  vehicle_plate_expiration_date?: string
  vehicle_plate_decal?: string
  vehicle_previous_plate_number?: string
  vehicle_plate_first_seen_date?: string
  vehicle_previous_plate_state?: string
  vehicle_plate_last_seen_date?: string
  vehicle_previous_plate_type?: string
  vehicle_previous_expiration_date?: string
  vehicle_previous_plate_decal?: string
  vehicle_renewal_date?: string
  vehicle_title_number?: string
  vehicle_title_transfer_date?: string
  vehicle_title_original_date?: string
  vehicle_registration_first_seen_date?: string
  vehicle_registration_last_seen_date?: string
  
  // Place of employment information
  poe_hit?: string
  poe_employer_name?: string
  poe_employer_phone?: string
  poe_phone?: string
  poe_cell?: string
  poe_employer_address?: string
  poe_employer_city?: string
  poe_employer_state?: string
  poe_employer_zip?: string
  poe_last_seen_date?: string
  poe_job_title?: string
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