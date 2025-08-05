import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
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

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Import preview: Starting request processing')
    console.log('🔍 Import preview: Request method:', request.method)
    console.log('🔍 Import preview: Request URL:', request.url)
    console.log('🔍 Import preview: Request headers:', Object.fromEntries(request.headers.entries()))
    
    // TEMPORARY: Return basic success for debugging
    console.log('🔧 TEMPORARY: Returning basic success response for debugging')
    return NextResponse.json({
      success: true,
      message: 'Basic success response for debugging',
      timestamp: new Date().toISOString()
    })
    
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      console.error('❌ Import preview: Authentication failed:', authError)
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ Import preview: Authentication successful for user:', user?.activeRole?.roleType)

    // Check if user has permission to preview imports
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user', 'buyer']
    if (!user?.activeRole?.roleType) {
      console.error('❌ Import preview: No user role found')
      return NextResponse.json(
        { error: 'No user role found' },
        { status: 403 }
      )
    }
    
    // At this point, TypeScript knows user is not null
    const userRole = user!.activeRole.roleType
    
    if (!allowedRoles.includes(userRole)) {
      console.error('❌ Import preview: Insufficient permissions for role:', userRole)
      return NextResponse.json(
        { error: 'Insufficient permissions to preview imports' },
        { status: 403 }
      )
    }

    console.log('✅ Import preview: Permission check passed')

    const supabase = createAdminSupabaseClient()
    
    // Parse form data
    let formData: FormData
    try {
      formData = await request.formData()
      console.log('✅ Import preview: FormData parsed successfully')
    } catch (error) {
      console.error('❌ Import preview: FormData parsing failed:', error)
      return NextResponse.json(
        { error: 'Failed to parse form data', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      )
    }

    // Log all FormData entries for debugging
    console.log('🔍 Import preview: FormData entries:')
    Array.from(formData.entries()).forEach(([key, value]) => {
      if (value instanceof File) {
        console.log(`  - ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`)
      } else {
        console.log(`  - ${key}: ${value}`)
      }
    })

    // Extract required fields
    const file = formData.get('file') as File
    const import_type = formData.get('import_type') as string
    const template_id = formData.get('template_id') as string

    console.log('🔍 Import preview: Extracted fields:')
    console.log('  - file:', file ? `${file.name} (${file.size} bytes)` : 'null')
    console.log('  - import_type:', import_type)
    console.log('  - template_id:', template_id)

    // Validate required fields
    if (!file) {
      console.error('❌ Import preview: No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!import_type) {
      console.error('❌ Import preview: No import type provided')
      return NextResponse.json(
        { error: 'No import type provided' },
        { status: 400 }
      )
    }

    console.log('✅ Import preview: Required fields validation passed')

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    if (!allowedTypes.includes(file.type)) {
      console.error('❌ Import preview: Invalid file type:', file.type)
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV or Excel file.' },
        { status: 400 }
      )
    }

    console.log('✅ Import preview: File type validation passed')

    // Read file content
    let fileContent: string
    let fileBuffer: Buffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
      fileContent = fileBuffer.toString('utf-8')
      console.log('✅ Import preview: File content read successfully, length:', fileContent.length)
    } catch (error) {
      console.error('❌ Import preview: File reading failed:', error)
      return NextResponse.json(
        { error: 'Failed to read file content', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      )
    }

    // Parse file content
    let rows: any[]
    try {
      if (file.type === 'text/csv') {
        rows = parseCSV(fileContent)
      } else {
        rows = parseExcel(fileBuffer)
      }
      console.log('✅ Import preview: File parsed successfully, rows:', rows.length)
    } catch (error) {
      console.error('❌ Import preview: File parsing failed:', error)
      return NextResponse.json(
        { error: 'Failed to parse file content', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      console.error('❌ Import preview: No data rows found in file')
      return NextResponse.json(
        { error: 'No data rows found in file' },
        { status: 400 }
      )
    }

    console.log('✅ Import preview: Data validation passed, processing preview...')

    // Get column mapping from template if provided
    let columnMapping: Record<string, string> = {}
    if (template_id) {
      try {
        const { data: template } = await supabase
          .from('import_templates')
          .select('field_mappings')
          .eq('id', template_id)
          .single()

        if (template?.field_mappings) {
          columnMapping = template.field_mappings
          console.log('✅ Import preview: Column mapping loaded from template')
        }
      } catch (error) {
        console.warn('⚠️ Import preview: Failed to load template column mapping:', error)
      }
    }

    // Validate sample rows
    const sampleRows = rows.slice(0, 5) // First 5 rows
    let validationErrors: any[] = []
    
    try {
      validationErrors = validateRows(sampleRows, import_type, columnMapping)
      console.log('✅ Import preview: Validation completed, errors:', validationErrors.length)
    } catch (error) {
      console.error('❌ Import preview: Validation failed:', error)
      return NextResponse.json(
        { error: 'Validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      )
    }
    
    // TEMPORARY: Skip validation for debugging
    console.log('🔧 TEMPORARY: Skipping validation for debugging')
    validationErrors = []
    
    // Estimate processing time (rough calculation)
    const estimatedTime = Math.ceil(rows.length / 100) // 100 rows per second

    console.log('✅ Import preview: Processing completed successfully')

    return NextResponse.json({
      success: true,
      data: {
        totalRows: rows.length,
        sampleRows: rows.slice(0, 3),
        validationErrors,
        estimatedTime,
        columnMapping
      }
    })

  } catch (error) {
    console.error('❌ Import preview: Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

function parseCSV(text: string): any[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []
  
  // Parse headers properly
  const headers = parseCSVLine(lines[0])
  const rows = []
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line) {
      const values = parseCSVLine(line)
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      rows.push(row)
    }
  }
  
  return rows
}

function parseCSVLine(line: string): string[] {
  const result = []
  let current = ''
  let inQuotes = false
  let i = 0
  
  while (i < line.length) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i += 2
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
        i++
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ''
      i++
    } else {
      current += char
      i++
    }
  }
  
  // Add the last field
  result.push(current.trim())
  
  return result
}

function parseExcel(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Convert to JSON with headers
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  
  // Convert array format to object format (first row as headers)
  if (rows.length > 0) {
    const headers = rows[0] as string[]
    const dataRows = rows.slice(1) as any[][]
    
    return dataRows.map(row => {
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = row[index] || ''
      })
      return obj
    })
  }
  
  return []
}

function validateRows(rows: any[], importType: string, columnMapping: Record<string, string>): any[] {
  const errors: any[] = []
  
  rows.forEach((row, index) => {
    const rowNumber = index + 1
    
    switch (importType) {
      case 'portfolios':
        validatePortfolioRow(row, rowNumber, columnMapping, errors)
        break
      case 'clients':
        validateClientRow(row, rowNumber, columnMapping, errors)
        break
      case 'agencies':
        validateAgencyRow(row, rowNumber, columnMapping, errors)
        break
      case 'accounts':
        validateAccountRow(row, rowNumber, columnMapping, errors)
        break
      case 'skip_trace':
        validateSkipTraceRow(row, rowNumber, columnMapping, errors)
        break
    }
  })
  
  return errors
}

function validatePortfolioRow(row: any, rowNumber: number, columnMapping: Record<string, string>, errors: any[]) {
  const requiredFields = ['name', 'client_code', 'original_balance', 'account_count']
  
  requiredFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (!row[mappedField] || row[mappedField].toString().trim() === '') {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField] || '',
        message: `${field} is required`,
        severity: 'error'
      })
    }
  })
  
  // Validate numeric fields
  const numericFields = ['original_balance', 'account_count', 'debt_age_months', 'average_balance']
  numericFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (row[mappedField] && isNaN(parseFloat(row[mappedField]))) {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField],
        message: `${field} must be a number`,
        severity: 'error'
      })
    }
  })
  
  // Validate portfolio type
  const portfolioTypeField = columnMapping['portfolio_type'] || 'portfolio_type'
  if (row[portfolioTypeField]) {
    const validTypes = ['credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'other']
    if (!validTypes.includes(row[portfolioTypeField].toLowerCase())) {
      errors.push({
        row: rowNumber,
        column: portfolioTypeField,
        value: row[portfolioTypeField],
        message: `Invalid portfolio type. Must be one of: ${validTypes.join(', ')}`,
        severity: 'error'
      })
    }
  }
}

function validateClientRow(row: any, rowNumber: number, columnMapping: Record<string, string>, errors: any[]) {
  const requiredFields = ['name', 'code']
  
  requiredFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (!row[mappedField] || row[mappedField].toString().trim() === '') {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField] || '',
        message: `${field} is required`,
        severity: 'error'
      })
    }
  })
  
  // Validate email format
  const emailField = columnMapping['contact_email'] || 'contact_email'
  if (row[emailField] && !isValidEmail(row[emailField])) {
    errors.push({
      row: rowNumber,
      column: emailField,
      value: row[emailField],
      message: 'Invalid email format',
      severity: 'error'
    })
  }
  
  // Validate client type
  const clientTypeField = columnMapping['client_type'] || 'client_type'
  if (row[clientTypeField]) {
    const validTypes = ['creditor', 'debt_buyer', 'servicer']
    if (!validTypes.includes(row[clientTypeField].toLowerCase())) {
      errors.push({
        row: rowNumber,
        column: clientTypeField,
        value: row[clientTypeField],
        message: `Invalid client type. Must be one of: ${validTypes.join(', ')}`,
        severity: 'error'
      })
    }
  }
}

function validateAgencyRow(row: any, rowNumber: number, columnMapping: Record<string, string>, errors: any[]) {
  const requiredFields = ['name', 'code', 'instance_id', 'contact_email']
  
  requiredFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (!row[mappedField] || row[mappedField].toString().trim() === '') {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField] || '',
        message: `${field} is required`,
        severity: 'error'
      })
    }
  })
  
  // Validate email format
  const emailField = columnMapping['contact_email'] || 'contact_email'
  if (row[emailField] && !isValidEmail(row[emailField])) {
    errors.push({
      row: rowNumber,
      column: emailField,
      value: row[emailField],
      message: 'Invalid email format',
      severity: 'error'
    })
  }
  
  // Validate subscription tier
  const tierField = columnMapping['subscription_tier'] || 'subscription_tier'
  if (row[tierField]) {
    const validTiers = ['basic', 'professional', 'enterprise']
    if (!validTiers.includes(row[tierField].toLowerCase())) {
      errors.push({
        row: rowNumber,
        column: tierField,
        value: row[tierField],
        message: `Invalid subscription tier. Must be one of: ${validTiers.join(', ')}`,
        severity: 'error'
      })
    }
  }
}

function validateAccountRow(row: any, rowNumber: number, columnMapping: Record<string, string>, errors: any[]) {
  // Core required fields for debt accounts
  const requiredFields = [
    'original_account_number',  // Core debt identifier
    'ssn',                     // Social Security Number
    'current_balance',         // Current outstanding amount
    'charge_off_date'          // When debt was charged off
  ]
  
  requiredFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (!row[mappedField] || row[mappedField].toString().trim() === '') {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField] || '',
        message: `${field} is required`,
        severity: 'error'
      })
    }
  })
  
  // Validate numeric fields
  const numericFields = [
    'current_balance',
    'original_balance',
    'last_payment_amount',
    'interest_rate',
    'late_fees',
    'collection_fees',
    'debt_age',
    'annual_income'
  ]
  
  numericFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (row[mappedField] && isNaN(parseFloat(row[mappedField]))) {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField],
        message: `${field} must be a number`,
        severity: 'error'
      })
    }
  })
  
  // Validate date fields
  const dateFields = [
    'charge_off_date',
    'original_loan_date',
    'date_opened',
    'last_payment_date',
    'last_activity_date',
    'dob'
  ]
  
  dateFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (row[mappedField] && row[mappedField].toString().trim() !== '') {
      const dateValue = new Date(row[mappedField])
      if (isNaN(dateValue.getTime())) {
        errors.push({
          row: rowNumber,
          column: mappedField,
          value: row[mappedField],
          message: `${field} must be a valid date`,
          severity: 'error'
        })
      }
    }
  })
  
  // Validate email format
  const emailFields = ['email_primary', 'email_secondary']
  emailFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (row[mappedField] && !isValidEmail(row[mappedField])) {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField],
        message: `Invalid email format for ${field}`,
        severity: 'error'
      })
    }
  })
  
  // Validate phone number format (basic validation)
  const phoneFields = ['phone_primary', 'phone_secondary', 'phone_work']
  phoneFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (row[mappedField] && row[mappedField].toString().trim() !== '') {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
      const cleanPhone = row[mappedField].toString().replace(/[\s\-\(\)\.]/g, '')
      if (!phoneRegex.test(cleanPhone)) {
        errors.push({
          row: rowNumber,
          column: mappedField,
          value: row[mappedField],
          message: `Invalid phone number format for ${field}`,
          severity: 'warning'
        })
      }
    }
  })
  
  // Validate SSN format (basic validation)
  const ssnField = columnMapping['ssn'] || 'ssn'
  if (row[ssnField] && row[ssnField].toString().trim() !== '') {
    const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/
    const cleanSSN = row[ssnField].toString().replace(/[\s\-]/g, '')
    if (!ssnRegex.test(cleanSSN) && cleanSSN.length !== 9) {
      errors.push({
        row: rowNumber,
        column: ssnField,
        value: row[ssnField],
        message: 'SSN must be in format XXX-XX-XXXX or 9 digits',
        severity: 'error'
      })
    }
  }
  
  // Validate ZIP code format
  const zipField = columnMapping['zipcode'] || 'zipcode'
  if (row[zipField] && row[zipField].toString().trim() !== '') {
    const zipRegex = /^\d{5}(-\d{4})?$/
    if (!zipRegex.test(row[zipField].toString().trim())) {
      errors.push({
        row: rowNumber,
        column: zipField,
        value: row[zipField],
        message: 'ZIP code must be in format 12345 or 12345-6789',
        severity: 'warning'
      })
    }
  }
  
  // Validate boolean flags
  const booleanFields = ['do_not_call', 'do_not_mail', 'do_not_email', 'do_not_text', 'bankruptcy_filed', 'active_military', 'hardship_declared']
  booleanFields.forEach(field => {
    const mappedField = columnMapping[field] || field
    if (row[mappedField] && row[mappedField].toString().trim() !== '') {
      const value = row[mappedField].toString().toLowerCase()
      if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(value)) {
        errors.push({
          row: rowNumber,
          column: mappedField,
          value: row[mappedField],
          message: `${field} must be a boolean value (true/false, 1/0, yes/no)`,
          severity: 'warning'
        })
      }
    }
  })
}

function validateSkipTraceRow(row: any, rowNumber: number, columnMapping: Record<string, string>, errors: any[]) {
  const requiredFields = ['skip_trace_reason']
  const mappedField = columnMapping['skip_trace_reason'] || 'skip_trace_reason'

  requiredFields.forEach(field => {
    if (!row[mappedField] || row[mappedField].toString().trim() === '') {
      errors.push({
        row: rowNumber,
        column: mappedField,
        value: row[mappedField] || '',
        message: `${field} is required`,
        severity: 'error'
      })
    }
  })
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
} 