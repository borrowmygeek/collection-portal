import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// Only create client if environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    const formData = await request.formData()
    
    const file = formData.get('file') as File
    const import_type = formData.get('import_type') as string
    const template_id = formData.get('template_id') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    if (!import_type) {
      return NextResponse.json(
        { error: 'Import type is required' },
        { status: 400 }
      )
    }
    
    // Parse file to get preview data
    let rows: any[] = []
    let columnMapping: Record<string, string> = {}
    let validationErrors: any[] = []
    
    console.log(`File type: ${file.type}`)
    console.log(`File name: ${file.name}`)
    console.log(`File size: ${file.size}`)
    
    // Determine if it's a CSV file (check both MIME type and file extension)
    const isCSV = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
    console.log(`Is CSV file: ${isCSV}`)
    
    if (isCSV) {
      const text = await file.text()
      console.log(`Preview CSV file content length: ${text.length}`)
      console.log(`Preview CSV file first 500 characters: ${text.substring(0, 500)}`)
      console.log(`Preview CSV file last 500 characters: ${text.substring(Math.max(0, text.length - 500))}`)
      
      // Count lines manually
      const lines = text.split('\n')
      console.log(`Total lines in file: ${lines.length}`)
      console.log(`Non-empty lines: ${lines.filter(line => line.trim()).length}`)
      
      rows = parseCSV(text)
      console.log(`Preview parsed ${rows.length} rows from CSV`)
      if (rows.length > 0) {
        console.log(`Preview first row headers: ${Object.keys(rows[0]).join(', ')}`)
        console.log(`Preview first row sample: ${JSON.stringify(rows[0])}`)
        if (rows.length > 1) {
          console.log(`Preview second row sample: ${JSON.stringify(rows[1])}`)
        }
      }
    } else {
      // For Excel files, parse using xlsx library
      console.log('Processing as Excel file')
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      console.log(`Excel sheet name: ${sheetName}`)
      console.log(`Excel sheet range: ${worksheet['!ref']}`)
      
      // Convert to JSON
      rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      // Convert array format to object format (first row as headers)
      if (rows.length > 0) {
        const headers = rows[0] as string[]
        const dataRows = rows.slice(1) as any[][]
        
        rows = dataRows.map(row => {
          const obj: any = {}
          headers.forEach((header, index) => {
            obj[header] = row[index] || ''
          })
          return obj
        })
      }
      
      console.log(`Excel parsed ${rows.length} data rows (excluding header)`)
    }
    
    // Get template if provided
    let template = null
    if (template_id) {
      const { data: templateData } = await supabase
        .from('import_templates')
        .select('*')
        .eq('id', template_id)
        .single()
      template = templateData
    }
    
    // Auto-map columns if template is provided
    if (template && rows.length > 0) {
      const headers = Object.keys(rows[0])
      const templateColumns = [...template.required_columns, ...template.optional_columns]
      
      templateColumns.forEach(templateCol => {
        const matchingHeader = headers.find(header => 
          header.toLowerCase().includes(templateCol.toLowerCase()) ||
          templateCol.toLowerCase().includes(header.toLowerCase())
        )
        if (matchingHeader) {
          columnMapping[templateCol] = matchingHeader
        }
      })
    }
    
    // Validate sample rows
    const sampleRows = rows.slice(0, 5) // First 5 rows
    validationErrors = validateRows(sampleRows, import_type, columnMapping)
    
    // Estimate processing time (rough calculation)
    const estimatedTime = Math.ceil(rows.length / 100) // 100 rows per second
    
    // Determine file type
    const fileType = isCSV ? 'csv' : 'excel'
    
    const preview = {
      total_rows: rows.length,
      sample_rows: sampleRows,
      column_mapping: columnMapping,
      validation_errors: validationErrors,
      estimated_time: estimatedTime,
      file_type: fileType,
      headers: rows.length > 0 ? Object.keys(rows[0]) : []
    }
    
    return NextResponse.json({ preview })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
  // This would validate account-specific fields
  // Implementation depends on your account table structure
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
} 