import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
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
    
    // Parse FormData
    console.log('🔍 Import preview: Parsing FormData...')
    const formData = await request.formData()
    
    // Extract form fields
    const file = formData.get('file') as File
    const importType = formData.get('import_type') as string
    const templateId = formData.get('template_id') as string
    
    console.log('🔍 Import preview: FormData extracted:', {
      fileName: file?.name,
      fileSize: file?.size,
      importType,
      templateId
    })
    
    // Validate file
    if (!file) {
      console.error('❌ Import preview: No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    if (!allowedTypes.includes(file.type)) {
      console.error('❌ Import preview: Invalid file type:', file.type)
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV or Excel file.' },
        { status: 400 }
      )
    }
    
    console.log('✅ Import preview: File validation passed')
    
    // Read and parse file
    console.log('🔍 Import preview: Reading file...')
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    
    let rows: any[] = []
    let headers: string[] = []
    
    if (file.type === 'text/csv') {
      console.log('🔍 Import preview: Parsing CSV file...')
      const csvText = fileBuffer.toString('utf-8')
      const lines = csvText.split('\n').filter(line => line.trim())
      
      if (lines.length > 0) {
        headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
          const obj: any = {}
          headers.forEach((header, index) => {
            obj[header] = values[index] || ''
          })
          return obj
        })
      }
    } else {
      console.log('🔍 Import preview: Parsing Excel file...')
      // Parse Excel file using exceljs library
      try {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(arrayBuffer)
        const worksheet = workbook.worksheets[0]
        
        if (!worksheet) {
          return NextResponse.json({ error: 'No worksheet found in Excel file' }, { status: 400 })
        }
        
        // Convert worksheet to JSON with headers
        const jsonData: any[][] = []
        const dimensions = worksheet.dimensions
        
        if (dimensions) {
          // Read header row
          const headerRow: any[] = []
          for (let col = dimensions.left; col <= dimensions.right; col++) {
            const cell = worksheet.getCell(dimensions.top, col)
            headerRow.push(cell.value?.toString() || '')
          }
          jsonData.push(headerRow)
          
          // Read data rows
          for (let row = dimensions.top + 1; row <= dimensions.bottom; row++) {
            const dataRow: any[] = []
            for (let col = dimensions.left; col <= dimensions.right; col++) {
              const cell = worksheet.getCell(row, col)
              dataRow.push(cell.value?.toString() || '')
            }
            jsonData.push(dataRow)
          }
        }
        
        if (jsonData.length > 0) {
          headers = jsonData[0].map(h => String(h || '').trim())
          rows = jsonData.slice(1).map(row => {
            const obj: any = {}
            headers.forEach((header, index) => {
              obj[header] = row[index] ? String(row[index]).trim() : ''
            })
            return obj
          })
        }
        
        console.log('✅ Import preview: Excel file parsed successfully')
      } catch (error) {
        console.error('❌ Import preview: Error parsing Excel file:', error)
        return NextResponse.json(
          { error: 'Error parsing Excel file. Please ensure it\'s a valid Excel file.' },
          { status: 400 }
        )
      }
    }
    
    console.log('✅ Import preview: File parsed successfully:', {
      totalRows: rows.length,
      headers: headers.length,
      sampleRows: rows.slice(0, 3)
    })
    
    // Return preview data
    return NextResponse.json({
      preview: {
        total_rows: rows.length,
        sample_rows: rows.slice(0, 10), // Show first 10 rows
        headers: headers,
        file_type: file.type === 'text/csv' ? 'csv' : 'excel',
        file_size: file.size,
        validation_errors: []
      }
    })

  } catch (error: unknown) {
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