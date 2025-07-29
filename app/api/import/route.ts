import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { authenticateApiRequest, requireRole } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

// Only create client if environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
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

    // Check if user has permission to view import jobs
    if (!requireRole(user, ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const import_type = searchParams.get('import_type')
    
    const offset = (page - 1) * limit
    
    let query = supabase
      .from('import_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // Filter by user's agency if not platform admin
    if (user.role !== 'platform_admin') {
      if (user.agency_id) {
        query = query.eq('agency_id', user.agency_id)
      }
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (import_type) {
      query = query.eq('import_type', import_type)
    }
    
    const { data: jobs, error, count } = await query
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('Error fetching import jobs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch import jobs' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to create import jobs
    if (!requireRole(user, ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const importType = formData.get('import_type') as string
    const templateId = formData.get('template_id') as string
    
    // Portfolio selection for account imports
    const portfolioId = formData.get('portfolio_id') as string
    const newPortfolioData = formData.get('new_portfolio') as string

    if (!file || !importType) {
      return NextResponse.json(
        { error: 'File and import type are required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only CSV and Excel files are supported.' },
        { status: 400 }
      )
    }

    // Create import job
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        user_id: user.auth_user_id, // Use auth_user_id instead of user.id
        file_name: file.name,
        file_size: file.size,
        file_type: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
        import_type: importType,
        template_id: templateId || null,
        portfolio_id: null, // Will be updated after portfolio creation
        status: 'pending',
        agency_id: user.agency_id || null
      })
      .select()
      .single()

    if (jobError) {
      console.error('Error creating import job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create import job' },
        { status: 500 }
      )
    }

    // Handle portfolio creation for account imports
    let finalPortfolioId = portfolioId
    if (importType === 'accounts' && newPortfolioData) {
      try {
        const newPortfolio = JSON.parse(newPortfolioData)
        
        // Create the new portfolio
        const { data: createdPortfolio, error: portfolioError } = await supabase
          .from('master_portfolios')
          .insert({
            name: newPortfolio.name,
            description: newPortfolio.description,
            portfolio_type: newPortfolio.portfolio_type,
            client_id: newPortfolio.client_id,
            original_balance: 0, // Will be calculated from imported accounts
            account_count: 0 // Will be calculated from imported accounts
          })
          .select()
          .single()

        if (portfolioError) {
          throw new Error(`Failed to create portfolio: ${portfolioError.message}`)
        }

        finalPortfolioId = createdPortfolio.id

        // Update the import job with the portfolio_id
        await supabase
          .from('import_jobs')
          .update({ portfolio_id: finalPortfolioId })
          .eq('id', job.id)
      } catch (error) {
        console.error('Error creating portfolio:', error)
        return NextResponse.json(
          { error: 'Failed to create portfolio' },
          { status: 500 }
        )
      }
    } else if (importType === 'accounts' && portfolioId) {
      // Update the import job with the selected portfolio_id
      await supabase
        .from('import_jobs')
        .update({ portfolio_id: portfolioId })
        .eq('id', job.id)
    }

    const fieldMappingRaw = formData.get('field_mapping') as string
    let fieldMapping: Record<string, string> = {}
    if (fieldMappingRaw) {
      try {
        fieldMapping = JSON.parse(fieldMappingRaw)
      } catch {}
    }

    // Upload file to storage
    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('import-files')
      .upload(`${user.id}/${job.file_name}`, fileBuffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError)
      // Clean up the import job if file upload fails
      await supabase
        .from('import_jobs')
        .delete()
        .eq('id', job.id)
      
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Process the import in the background
    processImportJob(job.id, supabase, user.id, finalPortfolioId, fieldMapping)

    return NextResponse.json({
      success: true,
      job_id: job.id,
      message: 'Import job created successfully'
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to delete import jobs
    if (!requireRole(user, ['platform_admin', 'agency_admin', 'client_admin'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete import jobs' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseClient()
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')
    const fileName = searchParams.get('file_name')

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Get the import job to verify ownership and permissions
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to delete this specific job
    if (user.role !== 'platform_admin' && user.agency_id !== job.agency_id) {
      return NextResponse.json(
        { error: 'Access denied to this import job' },
        { status: 403 }
      )
    }

    // Verify file name matches
    if (job.file_name !== fileName) {
      return NextResponse.json(
        { error: 'File name does not match' },
        { status: 400 }
      )
    }

    // 1. Get all person IDs from debtors in this import job
    const { data: debtors, error: debtorsError } = await supabase
      .from('debtors')
      .select('person_id')
      .eq('import_batch_id', jobId)
      .not('person_id', 'is', null)

    if (debtorsError) {
      console.error('Error fetching debtors:', debtorsError)
      return NextResponse.json(
        { error: 'Failed to fetch debtors' },
        { status: 500 }
      )
    }

    const personIds = debtors.map(d => d.person_id).filter(id => id !== null)

    // 2. Delete all debtors from this import job
    const { error: debtorsDeleteError } = await supabase
      .from('debtors')
      .delete()
      .eq('import_batch_id', jobId)

    if (debtorsDeleteError) {
      console.error('Error deleting debtors:', debtorsDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete debtors' },
        { status: 500 }
      )
    }

    // 3. Delete persons ONLY if they have no remaining debtors and no payments
    if (personIds.length > 0) {
      // Get all person IDs that are still referenced by other debtors
      const { data: remainingPersons } = await supabase
        .from('debtors')
        .select('person_id')
        .not('person_id', 'is', null)

      const remainingPersonIds = remainingPersons?.map(d => d.person_id) || []
      const orphanedPersonIds = personIds.filter(id => !remainingPersonIds.includes(id))

      if (orphanedPersonIds.length > 0) {
        // Check if any of these persons have payments
        const { data: paymentPersons } = await supabase
          .from('payments')
          .select('person_id')
          .in('person_id', orphanedPersonIds)

        const paymentPersonIds = paymentPersons?.map(p => p.person_id) || []
        const trulyOrphanedPersonIds = orphanedPersonIds.filter(id => !paymentPersonIds.includes(id))

        if (trulyOrphanedPersonIds.length > 0) {
          await supabase
            .from('persons')
            .delete()
            .in('id', trulyOrphanedPersonIds)
        }
      }
    }

    // 4. Delete the import job
    const { error: jobDeleteError } = await supabase
      .from('import_jobs')
      .delete()
      .eq('id', jobId)

    if (jobDeleteError) {
      console.error('Error deleting import job:', jobDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete import job' },
        { status: 500 }
      )
    }

    // 5. Delete the file from storage
    try {
      await supabase.storage
        .from('import-files')
        .remove([`${user.id}/${job.file_name}`])
    } catch (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Don't fail the request if file deletion fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted import job "${job.file_name}" and all associated accounts`
    })

  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processImportJob(jobId: string, supabase: any, userId: string, portfolioId?: string, fieldMapping?: Record<string, string>) {
  try {
    // Update job status to processing
    await supabase
      .from('import_jobs')
      .update({ status: 'processing', progress: 0 })
      .eq('id', jobId)

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error(`[IMPORT] Job not found: ${jobError?.message}`)
      throw new Error('Job not found')
    }

    // Get file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('import-files')
      .download(`${userId}/${job.file_name}`)

    if (fileError || !fileData) {
      console.error(`[IMPORT] File not found in storage: ${fileError?.message}`)
      throw new Error('File not found in storage')
    }

    // Parse file content
    let rows: any[] = []
    if (job.file_type === 'csv') {
      const text = await fileData.text()
      rows = parseCSV(text)
    } else {
      // For Excel files, parse using xlsx library
      const arrayBuffer = await fileData.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      // Get the first sheet
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      // Convert to JSON
      const excelRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      // Convert array format to object format (first row as headers)
      if (excelRows.length > 0) {
        const headers = excelRows[0] as string[]
        const dataRows = excelRows.slice(1) as any[][]

        rows = dataRows.map(row => {
          const obj: any = {}
          headers.forEach((header, index) => {
            obj[header] = row[index] || ''
          })
          return obj
        })
      }
    }

    if (rows.length === 0) {
      throw new Error('No data found in file')
    }

    // Update job with total rows
    await supabase
      .from('import_jobs')
      .update({ total_rows: rows.length })
      .eq('id', jobId)

    let successfulRows = 0
    let failedRows = 0
    let errors: any[] = []
    const failedRowsData: any[] = [] // Store original row data for failed rows

    // Process each row
    if (job.import_type === 'accounts' && portfolioId) {
      // Use bulk processing for accounts
      const bulkResults = await bulkProcessAccounts(rows, supabase, userId, portfolioId, fieldMapping, jobId)
      successfulRows = bulkResults.successful
      failedRows = bulkResults.failed
      errors = bulkResults.errors
      
      // Convert bulk errors to failed rows data format
      for (const error of errors) {
        failedRowsData.push({
          row_number: error.row || 0,
          original_data: error.original_data || {},
          mapped_data: error.original_data || {},
          error_message: error.message,
          error_type: 'ImportError'
        })
      }
    } else {
      // Use individual processing for other import types
      for (let i = 0; i < rows.length; i++) {
        let mappedRow = rows[i] // Declare outside try block for catch block access
        
        try {
          // Map row fields using fieldMapping if provided
          if (fieldMapping && Object.keys(fieldMapping).length > 0) {
            mappedRow = {}
            for (const [targetField, fileColumn] of Object.entries(fieldMapping)) {
              mappedRow[targetField] = rows[i][fileColumn]
            }
          }
          
          await processRow(mappedRow, job.import_type, supabase, userId, portfolioId, fieldMapping, jobId)
          successfulRows++
        } catch (error: any) {
          failedRows++
          const errorMsg = `Row ${i + 1}: ${error.message}`
          console.error(`[IMPORT] ${errorMsg}`)
          
          // Store error details
          errors.push({
            row: i + 1,
            column: 'general',
            value: '',
            message: error.message,
            severity: 'error'
          })
          
          // Store failed row data for CSV export
          failedRowsData.push({
            row_number: i + 1,
            original_data: rows[i],
            mapped_data: mappedRow || rows[i],
            error_message: error.message,
            error_type: error.name || 'ImportError'
          })
        }

        // Update progress every 10 rows
        if ((i + 1) % 10 === 0) {
          const progress = Math.round(((i + 1) / rows.length) * 100)
          const updateData: any = { 
            progress,
            successful_rows: successfulRows,
            failed_rows: failedRows
          }
          
          // If we've reached 100%, also update the status
          if (progress === 100) {
            updateData.status = failedRows === 0 ? 'completed' : 'completed_with_errors'
          }
          
          await supabase
            .from('import_jobs')
            .update(updateData)
            .eq('id', jobId)
        }
      }
    }

    // Generate and store failed rows CSV if there are failed rows
    let failedRowsCsvPath: string | null = null
    if (failedRowsData.length > 0) {
      try {
        failedRowsCsvPath = await generateFailedRowsCSV(failedRowsData, jobId, supabase, userId)
      } catch (csvError) {
        console.error(`[IMPORT] Error generating failed rows CSV:`, csvError)
      }
    }

    // Final update to ensure status is set correctly
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'completed', 
        progress: 100,
        successful_rows: successfulRows,
        failed_rows: failedRows,
        errors: errors.length > 0 ? errors : null,
        failed_rows_csv_path: failedRowsCsvPath
      })
      .eq('id', jobId)

  } catch (error: any) {
    console.error(`[IMPORT] Fatal error in import job ${jobId}:`, error)
    
    // Update job status to failed
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'failed', 
        errors: [{ message: error.message, severity: 'fatal' }]
      })
      .eq('id', jobId)
    
    throw error
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

// Generate CSV from failed rows data
async function generateFailedRowsCSV(failedRowsData: any[], jobId: string, supabase: any, userId: string): Promise<string> {
  // Create CSV content
  const headers = ['Row Number', 'Error Message', 'Error Type', 'Original Data', 'Mapped Data']
  const csvRows = [headers.join(',')]
  
  for (const row of failedRowsData) {
    const csvRow = [
      row.row_number,
      `"${(row.error_message || '').replace(/"/g, '""')}"`,
      row.error_type || 'Unknown',
      `"${JSON.stringify(row.original_data || {}).replace(/"/g, '""')}"`,
      `"${JSON.stringify(row.mapped_data || {}).replace(/"/g, '""')}"`
    ]
    csvRows.push(csvRow.join(','))
  }
  
  const csvContent = csvRows.join('\n')
  
  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from('import-files')
    .upload(`${userId}/failed_rows_${jobId}.csv`, csvContent, {
      contentType: 'text/csv',
      upsert: true
    })
  
  if (error) throw error
  return data.path
}

// Helper function to format SSN
function formatSSN(ssn: string | null | undefined): string | null {
  if (!ssn) return null
  let formatted = String(ssn).trim().toUpperCase()
  
  if (formatted.startsWith('Z')) {
    formatted = '0' + formatted.substring(1)
  }
  
  const beforeClean = formatted
  formatted = formatted.replace(/\D/g, '') // Remove non-digits
  
  // Basic validation for 9 digits and common invalid patterns
  if (formatted.length !== 9) {
    return null
  }
  
  // Check for common invalid patterns
  if (/^(0{9}|1{9}|2{9}|3{9}|4{9}|5{9}|6{9}|7{9}|8{9}|9{9}|123456789|987654321)$/.test(formatted)) {
    return null
  }
  
  // Check for invalid ranges (SSNs starting with 000, 666, 900-999 are invalid)
  const firstThree = parseInt(formatted.substring(0, 3))
  if (firstThree === 0 || firstThree === 666 || firstThree >= 900) {
    return null
  }
  
  return formatted
}

// Helper function to safely convert date strings
function parseDate(dateString: string | null | undefined): string | null {
  if (!dateString || typeof dateString !== 'string') return null
  
  const trimmed = dateString.trim()
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null
  
  // Try to parse the date
  const date = new Date(trimmed)
  if (isNaN(date.getTime())) return null
  
  // Return ISO string format
  return date.toISOString().split('T')[0]
}

// Data quality scoring and corruption detection
interface DataQualityScore {
  overallScore: number // 0-100
  balanceScore: number // 0-100
  accountNumberScore: number // 0-100
  ssnScore: number // 0-100
  warnings: string[]
  flags: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

function assessDataQuality(mappedRow: any, existingDebtors: any[]): DataQualityScore {
  const warnings: string[] = []
  const flags: string[] = []
  let balanceScore = 100
  let accountNumberScore = 100
  let ssnScore = 100

  // Balance analysis
  const currentBalance = parseFloat(mappedRow.current_balance) || parseFloat(mappedRow.original_balance) || 0
  const originalBalance = parseFloat(mappedRow.original_balance) || parseFloat(mappedRow.current_balance) || 0
  
  // Check for suspicious balance patterns
  if (currentBalance > 0 && originalBalance > 0) {
    const balanceRatio = currentBalance / originalBalance
    
    // Suspicious balance increases
    if (balanceRatio > 1.5) {
      warnings.push(`Balance increased by ${((balanceRatio - 1) * 100).toFixed(1)}% (suspicious)`)
      balanceScore -= 30
      if (balanceRatio > 2.0) {
        flags.push('EXCESSIVE_BALANCE_INCREASE')
        balanceScore -= 20
      }
    }
    
    // Suspicious balance decreases (could indicate data corruption)
    if (balanceRatio < 0.8) {
      warnings.push(`Balance decreased by ${((1 - balanceRatio) * 100).toFixed(1)}% (suspicious)`)
      balanceScore -= 25
      if (balanceRatio < 0.5) {
        flags.push('EXCESSIVE_BALANCE_DECREASE')
        balanceScore -= 20
      }
    }
    
    // Check for rounded balances (common corruption pattern)
    const balanceRounded = Math.round(currentBalance / 100) * 100
    if (Math.abs(currentBalance - balanceRounded) < 1 && currentBalance > 1000) {
      warnings.push('Balance appears to be rounded to nearest $100')
      balanceScore -= 15
      flags.push('ROUNDED_BALANCE')
    }
    
    // Check for suspicious balance additions
    const suspiciousAdditions = [100, 50, 25, 10, 5]
    for (const addition of suspiciousAdditions) {
      if (Math.abs(currentBalance - (originalBalance + addition)) < 0.01) {
        warnings.push(`Balance appears to have $${addition} added (suspicious pattern)`)
        balanceScore -= 20
        flags.push('SUSPICIOUS_BALANCE_ADDITION')
        break
      }
    }
  }

  // Account number analysis
  const originalAccountNumber = mappedRow.original_account_number
  if (originalAccountNumber) {
    const accountStr = originalAccountNumber.toString()
    
    // Check for trailing zeros (common corruption pattern)
    if (accountStr.length > 5 && accountStr.endsWith('000')) {
      warnings.push('Account number ends with multiple zeros (suspicious)')
      accountNumberScore -= 25
      flags.push('TRAILING_ZEROS')
    }
    
    // Check for all zeros in last few digits
    const lastDigits = accountStr.slice(-3)
    if (lastDigits === '000' && accountStr.length > 3) {
      warnings.push('Last 3 digits of account number are zeros (suspicious)')
      accountNumberScore -= 30
      flags.push('ZERO_LAST_DIGITS')
    }
    
    // Check for suspicious patterns like all same digits
    const uniqueDigits = new Set(accountStr.split(''))
    if (uniqueDigits.size === 1 && accountStr.length > 3) {
      warnings.push('Account number contains all same digits (suspicious)')
      accountNumberScore -= 40
      flags.push('REPEATED_DIGITS')
    }
    
    // Check for sequential patterns
    if (accountStr.length >= 4) {
      let sequential = true
      for (let i = 1; i < accountStr.length; i++) {
        if (parseInt(accountStr[i]) !== parseInt(accountStr[i-1]) + 1) {
          sequential = false
          break
        }
      }
      if (sequential) {
        warnings.push('Account number contains sequential digits (suspicious)')
        accountNumberScore -= 35
        flags.push('SEQUENTIAL_DIGITS')
      }
    }
    
    // Check for suspicious length
    if (accountStr.length < 4) {
      warnings.push('Account number is unusually short')
      accountNumberScore -= 20
      flags.push('SHORT_ACCOUNT_NUMBER')
    }
    
    if (accountStr.length > 20) {
      warnings.push('Account number is unusually long')
      accountNumberScore -= 15
      flags.push('LONG_ACCOUNT_NUMBER')
    }
  }

  // SSN analysis
  const ssn = mappedRow.ssn
  if (ssn) {
    const ssnStr = ssn.toString().replace(/\D/g, '')
    
    // Check for suspicious SSN patterns
    if (ssnStr.length === 9) {
      // Check for all same digits
      const uniqueSSNDigits = new Set(ssnStr.split(''))
      if (uniqueSSNDigits.size === 1) {
        warnings.push('SSN contains all same digits (invalid)')
        ssnScore -= 50
        flags.push('INVALID_SSN_PATTERN')
      }
      
      // Check for sequential patterns
      let sequentialSSN = true
      for (let i = 1; i < ssnStr.length; i++) {
        if (parseInt(ssnStr[i]) !== parseInt(ssnStr[i-1]) + 1) {
          sequentialSSN = false
          break
        }
      }
      if (sequentialSSN) {
        warnings.push('SSN contains sequential digits (suspicious)')
        ssnScore -= 40
        flags.push('SEQUENTIAL_SSN')
      }
      
      // Check for common test SSNs
      const testSSNs = ['000000000', '111111111', '222222222', '333333333', '444444444', 
                       '555555555', '666666666', '777777777', '888888888', '999999999',
                       '123456789', '987654321']
      if (testSSNs.includes(ssnStr)) {
        warnings.push('SSN appears to be a test number')
        ssnScore -= 60
        flags.push('TEST_SSN')
      }
    }
  }

  // Cross-reference with existing data for consistency
  if (existingDebtors && existingDebtors.length > 0) {
    const existingSSNs = new Set(existingDebtors.map((d: any) => d.ssn))
    const existingBalances = existingDebtors.map((d: any) => d.current_balance)
    const avgBalance = existingBalances.reduce((a: number, b: number) => a + b, 0) / existingBalances.length
    
    // Check if balance is significantly different from portfolio average
    if (avgBalance > 0 && currentBalance > 0) {
      const balanceDeviation = Math.abs(currentBalance - avgBalance) / avgBalance
      if (balanceDeviation > 2.0) {
        warnings.push(`Balance is ${(balanceDeviation * 100).toFixed(1)}% different from portfolio average`)
        balanceScore -= 15
        flags.push('UNUSUAL_BALANCE')
      }
    }
  }

  // Calculate overall score
  const overallScore = Math.round((balanceScore + accountNumberScore + ssnScore) / 3)
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  if (overallScore >= 80) riskLevel = 'low'
  else if (overallScore >= 60) riskLevel = 'medium'
  else if (overallScore >= 40) riskLevel = 'high'
  else riskLevel = 'critical'

  return {
    overallScore,
    balanceScore,
    accountNumberScore,
    ssnScore,
    warnings,
    flags,
    riskLevel
  }
}

async function processRow(row: any, importType: string, supabase: any, userId: string, portfolioId?: string, fieldMapping?: Record<string, string>, jobId?: string) {
  switch (importType) {
    case 'portfolios':
      await processPortfolioRow(row, supabase)
      break
    case 'accounts':
      await processAccountRow(row, supabase, userId, portfolioId, fieldMapping, jobId)
      break
    case 'clients':
      await processClientRow(row, supabase)
      break
    case 'agencies':
      await processAgencyRow(row, supabase)
      break
    default:
      throw new Error(`Unknown import type: ${importType}`)
  }
}

async function processAccountRow(row: any, supabase: any, userId: string, portfolioId?: string, fieldMapping?: Record<string, string>, jobId?: string) {
  try {
    // The row is already mapped in the main processing loop, so we don't need to map it again
    const mappedRow = row

    // Get the platform_users record for the created_by field
    const { data: platformUser, error: userError } = await supabase
      .from('platform_users')
      .select('id')
      .eq('auth_user_id', userId)
      .single()

    if (userError) {
      console.error(`[ACCOUNT] Platform user lookup error:`, userError)
      throw new Error(`Platform user lookup failed: ${userError.message}`)
    }

    if (!platformUser) {
      console.error(`[ACCOUNT] Platform user not found for auth user: ${userId}`)
      throw new Error(`Platform user not found for auth user: ${userId}`)
    }

    // Get the portfolio to find the client
    if (!portfolioId) {
      console.error(`[ACCOUNT] No portfolio ID provided`)
      throw new Error('No portfolio ID provided')
    }

    // Get portfolio with client information
    const { data: portfolio, error: portfolioError } = await supabase
      .from('master_portfolios')
      .select(`
        id,
        name,
        client_id,
        master_clients!inner(
          id,
          name,
          code
        )
      `)
      .eq('id', portfolioId)
      .single()

    if (portfolioError) {
      console.error(`[ACCOUNT] Portfolio lookup error:`, portfolioError)
      throw new Error(`Portfolio lookup failed: ${portfolioError.message}`)
    }

    if (!portfolio) {
      console.error(`[ACCOUNT] Portfolio not found: ${portfolioId}`)
      throw new Error(`Portfolio not found: ${portfolioId}`)
    }

    // Check for duplicate accounts using original_account_number, ssn, and current_balance
    const currentBalance = parseFloat(mappedRow.current_balance) || parseFloat(mappedRow.original_balance) || 0
    const formattedSSN = formatSSN(mappedRow.ssn)
    const originalAccountNumber = mappedRow.original_account_number

    // Validate SSN - reject accounts without valid SSN
    if (!formattedSSN) {
      const errorMessage = `Invalid or missing SSN: ${mappedRow.ssn || 'null'}`
      throw new Error(errorMessage)
    }

    // Validate balance - reject accounts with balance under $25
    if (currentBalance < 25) {
      const errorMessage = `Balance too low: $${currentBalance} (minimum $25 required)`
      throw new Error(errorMessage)
    }

    // Validate original account number - reject accounts with blank original account numbers
    if (!originalAccountNumber || originalAccountNumber.trim() === '') {
      const errorMessage = `Missing or blank original account number`
      throw new Error(errorMessage)
    }

    // Get existing debtors for duplicate check and data quality assessment
    let existingDebtors: any[] = []
    if (originalAccountNumber && formattedSSN) {
      const { data: duplicateCheck, error: duplicateCheckError } = await supabase
        .from('debtors')
        .select('id, account_number, current_balance, portfolio_id')
        .eq('original_account_number', originalAccountNumber)
        .eq('ssn', formattedSSN)
        .eq('current_balance', currentBalance)

      if (duplicateCheckError) {
        console.error(`[ACCOUNT] Duplicate check error:`, duplicateCheckError)
        throw new Error(`Duplicate check failed: ${duplicateCheckError.message}`)
      }

      existingDebtors = duplicateCheck || []

      if (existingDebtors.length > 0) {
        // Check if the duplicate is in the same portfolio
        const isSamePortfolio = existingDebtors.some((debtor: any) => debtor.portfolio_id === portfolioId)
        
        if (isSamePortfolio) {
          return // Skip this row without throwing an error
        }
        // Continue with import if it's a different portfolio
      }
    }

    // Get portfolio debtors for data quality assessment
    let portfolioDebtors: any[] = []
    if (portfolioId) {
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('debtors')
        .select('ssn, current_balance')
        .eq('portfolio_id', portfolioId)
        .not('current_balance', 'is', null)

      if (!portfolioError && portfolioData) {
        portfolioDebtors = portfolioData
      }
    }

    // Assess data quality and detect suspicious patterns
    const dataQuality = assessDataQuality(mappedRow, portfolioDebtors)
    
    // Reject accounts with critical data quality issues
    if (dataQuality.riskLevel === 'critical') {
      const errorMessage = `Critical data quality issues detected: ${dataQuality.warnings.join(', ')}`
      throw new Error(errorMessage)
    }

    // Prepare debtor data
    const debtorData = {
      // Account identification fields
      account_number: mappedRow.account_number,
      original_account_number: mappedRow.original_account_number,
      external_id: mappedRow.external_id,
      import_batch_id: jobId, // Set to the actual import job ID
      ssn: formattedSSN, // Add SSN to debtors table
      
      // Creditor information
      original_creditor: mappedRow.original_creditor,
      original_creditor_name: mappedRow.original_creditor_name,
      
      // Balance and financial fields
      original_balance: parseFloat(mappedRow.original_balance) || parseFloat(mappedRow.current_balance) || 0,
      current_balance: parseFloat(mappedRow.current_balance) || parseFloat(mappedRow.original_balance) || 0,
      last_payment_amount: mappedRow.last_payment_amount ? parseFloat(mappedRow.last_payment_amount) : null,
      promise_to_pay_amount: mappedRow.promise_to_pay_amount ? parseFloat(mappedRow.promise_to_pay_amount) : null,
      settlement_offered: mappedRow.settlement_offered ? parseFloat(mappedRow.settlement_offered) : null,
      interest_rate: mappedRow.interest_rate ? parseFloat(mappedRow.interest_rate) : null,
      late_fees: mappedRow.late_fees ? parseFloat(mappedRow.late_fees) : null,
      collection_fees: mappedRow.collection_fees ? parseFloat(mappedRow.collection_fees) : null,
      legal_fees: mappedRow.legal_fees ? parseFloat(mappedRow.legal_fees) : null,
      total_fees: mappedRow.total_fees ? parseFloat(mappedRow.total_fees) : null,
      payment_plan_amount: mappedRow.payment_plan_amount ? parseFloat(mappedRow.payment_plan_amount) : null,
      
      // Account type and status fields
      account_type: mappedRow.account_type,
      account_subtype: mappedRow.account_subtype,
      account_status: mappedRow.account_status || 'active',
      
      // Date fields
      charge_off_date: parseDate(mappedRow.charge_off_date),
      date_opened: parseDate(mappedRow.date_opened),
      last_activity_date: parseDate(mappedRow.last_activity_date),
      last_payment_date: parseDate(mappedRow.last_payment_date),
      promise_to_pay_date: parseDate(mappedRow.promise_to_pay_date),
      next_payment_date: parseDate(mappedRow.next_payment_date),
      
      // Collection status and priority
      status: mappedRow.status || 'new',
      collection_status: mappedRow.collection_status || 'new',
      collection_priority: mappedRow.collection_priority || 'normal',
      
      // Contact and communication fields
      contact_method: mappedRow.contact_method,
      contact_result: mappedRow.contact_result,
      contact_notes: mappedRow.contact_notes,
      payment_plan_frequency: mappedRow.payment_plan_frequency,
      payment_frequency: mappedRow.payment_frequency,
      
      // Payment tracking fields
      total_payments: parseFloat(mappedRow.total_payments) || 0,
      payment_count: parseInt(mappedRow.payment_count) || 0,
      average_payment: mappedRow.average_payment ? parseFloat(mappedRow.average_payment) : null,
      largest_payment: mappedRow.largest_payment ? parseFloat(mappedRow.largest_payment) : null,
      
      // Compliance and flags
      do_not_call: mappedRow.do_not_call === 'true' || mappedRow.do_not_call === true,
      hardship_declared: mappedRow.hardship_declared === 'true' || mappedRow.hardship_declared === true,
      hardship_type: mappedRow.hardship_type,
      settlement_accepted: mappedRow.settlement_accepted === 'true' || mappedRow.settlement_accepted === true,
      
      // Data quality and source fields
      data_source: mappedRow.data_source,
      skip_trace_quality_score: mappedRow.skip_trace_quality_score ? parseFloat(mappedRow.skip_trace_quality_score) : null,
      notes: mappedRow.notes,
      
      // Data quality assessment fields
      data_quality_score: dataQuality.overallScore,
      data_quality_risk_level: dataQuality.riskLevel,
      data_quality_warnings: dataQuality.warnings.length > 0 ? dataQuality.warnings.join('; ') : null,
      data_quality_flags: dataQuality.flags.length > 0 ? dataQuality.flags.join('; ') : null,
      
      // Foreign keys
      portfolio_id: portfolioId,
      client_id: portfolio.master_clients.id,
      created_by: platformUser.id
    }

    // Create debtor (account) with new organized fields
    const { data: insertedDebtor, error } = await supabase
      .from('debtors')
      .insert(debtorData)
      .select()

    if (error) {
      console.error(`[ACCOUNT] Database insert error:`, error)
      console.error(`[ACCOUNT] Error details:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // Check if this is a duplicate constraint violation
      if (error.code === '23505' && error.message.includes('idx_debtors_unique_account')) {
        return // Skip this row without throwing an error
      }
      
      throw new Error(`Failed to create debtor: ${error.message}`)
    }
    
  } catch (error: any) {
    console.error(`[ACCOUNT] Error processing account row:`, error)
    throw new Error(`Error processing account row: ${error.message}`)
  }
}

async function processPortfolioRow(row: any, supabase: any) {
  // Validate required fields
  if (!row.name || !row.client_code) {
    throw new Error('Missing required fields: name, client_code')
  }
  
  // Validate numeric fields - allow 0 values
  if (row.original_balance === undefined || row.original_balance === null || 
      row.account_count === undefined || row.account_count === null) {
    throw new Error('Missing required numeric fields: original_balance, account_count')
  }
  
  // Get client ID from code
  const { data: client } = await supabase
    .from('master_clients')
    .select('id')
    .eq('code', row.client_code)
    .single()
  
  if (!client) {
    throw new Error(`Client not found with code: ${row.client_code}`)
  }
  
  // Create portfolio
  const { error } = await supabase
    .from('master_portfolios')
    .insert({
      name: row.name,
      description: row.description,
      client_id: client.id,
      portfolio_type: row.portfolio_type || 'credit_card',
      original_balance: parseFloat(row.original_balance) || 0,
      account_count: parseInt(row.account_count) || 0,
      charge_off_date: row.charge_off_date,
      debt_age_months: row.debt_age_months ? parseInt(row.debt_age_months) : null,
      average_balance: row.average_balance ? parseFloat(row.average_balance) : null,
      geographic_focus: row.geographic_focus ? [row.geographic_focus] : [],
      credit_score_range: row.credit_score_range || '',
      status: row.status || 'active'
    })
  
  if (error) {
    throw new Error(`Failed to create portfolio: ${error.message}`)
  }
}

async function processClientRow(row: any, supabase: any) {
  // Validate required fields
  if (!row.name || !row.code) {
    throw new Error('Missing required fields: name, code')
  }
  
  // Check if client already exists
  const { data: existing } = await supabase
    .from('master_clients')
    .select('id')
    .eq('code', row.code)
    .single()
  
  if (existing) {
    throw new Error(`Client with code ${row.code} already exists`)
  }
  
  // Create client
  const { error } = await supabase
    .from('master_clients')
    .insert({
      name: row.name,
      code: row.code,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      address: row.address,
      city: row.city,
      state: row.state,
      zipcode: row.zipcode,
      client_type: row.client_type || 'creditor',
      status: row.status || 'active'
    })
  
  if (error) {
    throw new Error(`Failed to create client: ${error.message}`)
  }
}

async function processAgencyRow(row: any, supabase: any) {
  // Validate required fields
  if (!row.name || !row.code || !row.instance_id || !row.contact_email) {
    throw new Error('Missing required fields: name, code, instance_id, contact_email')
  }
  
  // Check if agency already exists
  const { data: existing } = await supabase
    .from('master_agencies')
    .select('id')
    .eq('code', row.code)
    .single()
  
  if (existing) {
    throw new Error(`Agency with code ${row.code} already exists`)
  }
  
  // Create agency
  const { error } = await supabase
    .from('master_agencies')
    .insert({
      name: row.name,
      code: row.code,
      instance_id: row.instance_id,
      instance_url: row.instance_url,
      instance_anon_key: row.instance_anon_key,
      instance_service_key: row.instance_service_key,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      address: row.address,
      city: row.city,
      state: row.state,
      zipcode: row.zipcode,
      subscription_tier: row.subscription_tier || 'basic',
      subscription_status: row.subscription_status || 'active',
      status: row.status || 'active'
    })
  
  if (error) {
    throw new Error(`Failed to create agency: ${error.message}`)
  }
} 

// Bulk processing functions for better performance
async function bulkProcessAccounts(
  rows: any[], 
  supabase: any, 
  userId: string, 
  portfolioId: string, 
  fieldMapping: Record<string, string> | undefined,
  jobId: string
): Promise<{ successful: number, failed: number, errors: any[] }> {
  const BATCH_SIZE = 100
  const results = { successful: 0, failed: 0, errors: [] as any[] }
  
  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const batchResults = await processAccountBatch(batch, supabase, userId, portfolioId, fieldMapping, jobId)
    
    results.successful += batchResults.successful
    results.failed += batchResults.failed
    results.errors.push(...batchResults.errors)
    
    // Update progress after each batch
    const progress = Math.round(((i + BATCH_SIZE) / rows.length) * 100)
    const updateData: any = { 
      progress: Math.min(progress, 100),
      successful_rows: results.successful,
      failed_rows: results.failed
    }
    
    // If we've reached 100%, also update the status
    if (progress >= 100) {
      updateData.status = 'completed'
    }
    
    await supabase
      .from('import_jobs')
      .update(updateData)
      .eq('id', jobId)
  }
  
  // Ensure final status is set correctly after all batches are processed
  await supabase
    .from('import_jobs')
    .update({ 
      status: 'completed', 
      progress: 100,
      successful_rows: results.successful,
      failed_rows: results.failed
    })
    .eq('id', jobId)
  
  return results
}

async function processAccountBatch(
  batch: any[], 
  supabase: any, 
  userId: string, 
  portfolioId: string, 
  fieldMapping: Record<string, string> | undefined,
  jobId: string
): Promise<{ successful: number, failed: number, errors: any[] }> {
  const results = { successful: 0, failed: 0, errors: [] as any[] }
  
  // Get platform user once for the batch
  const { data: platformUser, error: userError } = await supabase
    .from('platform_users')
    .select('id')
    .eq('auth_user_id', userId)
    .single()

  if (userError || !platformUser) {
    throw new Error(`Platform user not found for auth user: ${userId}`)
  }

  // Get portfolio with client information once for the batch
  const { data: portfolio, error: portfolioError } = await supabase
    .from('master_portfolios')
    .select(`
      id,
      name,
      client_id,
      master_clients!inner(
        id,
        name,
        code
      )
    `)
    .eq('id', portfolioId)
    .single()

  if (portfolioError || !portfolio) {
    throw new Error(`Portfolio not found: ${portfolioId}`)
  }

  // Pre-process all rows in the batch
  const processedRows: any[] = []
  const personData: any[] = []
  const debtorData: any[] = []
  
  for (let i = 0; i < batch.length; i++) {
    try {
      const row = batch[i]
      let mappedRow = row
      
      // Map row fields if needed
      if (fieldMapping && Object.keys(fieldMapping).length > 0) {
        mappedRow = {}
        for (const [targetField, fileColumn] of Object.entries(fieldMapping)) {
          mappedRow[targetField] = row[fileColumn]
        }
      }
      
      // Validate and process the row
      const processed = await preprocessAccountRow(mappedRow, portfolio, platformUser, jobId, supabase)
      if (processed) {
        processedRows.push(processed)
        if (processed.personData) personData.push(processed.personData)
        if (processed.debtorData) debtorData.push(processed.debtorData)
      }
    } catch (error: any) {
      results.failed++
      results.errors.push({
        row: i + 1,
        message: error.message,
        original_data: batch[i]
      })
    }
  }
  
  // Bulk insert persons
  if (personData.length > 0) {
    const { data: insertedPersons, error: personError } = await supabase
      .from('persons')
      .insert(personData)
      .select('id, ssn')
    
    if (personError) {
      console.error('Bulk person insert error:', personError)
      // Fall back to individual inserts if bulk fails
      for (const person of personData) {
        try {
          await supabase.from('persons').insert(person)
        } catch (error: any) {
          results.failed++
          results.errors.push({
            message: `Failed to insert person: ${error.message}`,
            original_data: person
          })
        }
      }
    }
  }
  
  // Bulk insert debtors
  if (debtorData.length > 0) {
    const { error: debtorError } = await supabase
      .from('debtors')
      .insert(debtorData)
    
    if (debtorError) {
      console.error('Bulk debtor insert error:', debtorError)
      // Fall back to individual inserts if bulk fails
      for (const debtor of debtorData) {
        try {
          await supabase.from('debtors').insert(debtor)
          results.successful++
        } catch (error: any) {
          results.failed++
          results.errors.push({
            message: `Failed to insert debtor: ${error.message}`,
            original_data: debtor
          })
        }
      }
    } else {
      results.successful += debtorData.length
    }
  }
  
  return results
}

async function preprocessAccountRow(
  mappedRow: any, 
  portfolio: any, 
  platformUser: any, 
  jobId: string,
  supabase: any
): Promise<{ personData?: any, debtorData?: any } | null> {
  // Validate required fields
  const currentBalance = parseFloat(mappedRow.current_balance) || parseFloat(mappedRow.original_balance) || 0
  const formattedSSN = formatSSN(mappedRow.ssn)
  const originalAccountNumber = mappedRow.original_account_number

  // Apply validation rules
  if (!formattedSSN) {
    throw new Error(`Invalid or missing SSN: ${mappedRow.ssn || 'null'}`)
  }

  if (currentBalance < 25) {
    throw new Error(`Balance too low: $${currentBalance} (minimum $25 required)`)
  }

  if (!originalAccountNumber || originalAccountNumber.trim() === '') {
    throw new Error(`Missing or blank original account number`)
  }

  // Check for duplicates (simplified for bulk processing)
  const { data: existingDebtors } = await supabase
    .from('debtors')
    .select('id')
    .eq('original_account_number', originalAccountNumber)
    .eq('ssn', formattedSSN)
    .eq('current_balance', currentBalance)
    .eq('portfolio_id', portfolio.id)

  if (existingDebtors && existingDebtors.length > 0) {
    return null // Skip duplicate in same portfolio
  }

  // Prepare person data
  const personData = {
    ssn: formattedSSN,
    first_name: mappedRow.first_name || '',
    last_name: mappedRow.last_name || '',
    middle_name: mappedRow.middle_name || '',
    dob: parseDate(mappedRow.date_of_birth),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Prepare debtor data
  const debtorData = {
    // Account identification fields
    account_number: mappedRow.account_number || originalAccountNumber,
    original_account_number: originalAccountNumber,
    external_id: mappedRow.external_id,
    import_batch_id: jobId,
    ssn: formattedSSN,
    
    // Creditor information
    original_creditor: mappedRow.original_creditor,
    original_creditor_name: mappedRow.original_creditor_name,
    
    // Balance and financial fields
    original_balance: parseFloat(mappedRow.original_balance) || currentBalance,
    current_balance: currentBalance,
    last_payment_amount: mappedRow.last_payment_amount ? parseFloat(mappedRow.last_payment_amount) : null,
    promise_to_pay_amount: mappedRow.promise_to_pay_amount ? parseFloat(mappedRow.promise_to_pay_amount) : null,
    settlement_offered: mappedRow.settlement_offered ? parseFloat(mappedRow.settlement_offered) : null,
    interest_rate: mappedRow.interest_rate ? parseFloat(mappedRow.interest_rate) : null,
    late_fees: mappedRow.late_fees ? parseFloat(mappedRow.late_fees) : null,
    collection_fees: mappedRow.collection_fees ? parseFloat(mappedRow.collection_fees) : null,
    legal_fees: mappedRow.legal_fees ? parseFloat(mappedRow.legal_fees) : null,
    total_fees: mappedRow.total_fees ? parseFloat(mappedRow.total_fees) : null,
    payment_plan_amount: mappedRow.payment_plan_amount ? parseFloat(mappedRow.payment_plan_amount) : null,
    
    // Account type and status fields
    account_type: mappedRow.account_type,
    account_subtype: mappedRow.account_subtype,
    account_status: mappedRow.account_status || 'active',
    
    // Date fields
    charge_off_date: parseDate(mappedRow.charge_off_date),
    date_opened: parseDate(mappedRow.date_opened),
    last_activity_date: parseDate(mappedRow.last_activity_date),
    last_payment_date: parseDate(mappedRow.last_payment_date),
    promise_to_pay_date: parseDate(mappedRow.promise_to_pay_date),
    next_payment_date: parseDate(mappedRow.next_payment_date),
    
    // Collection status and priority
    status: mappedRow.status || 'new',
    collection_status: mappedRow.collection_status || 'new',
    collection_priority: mappedRow.collection_priority || 'normal',
    
    // Contact and communication fields
    contact_method: mappedRow.contact_method,
    contact_result: mappedRow.contact_result,
    contact_notes: mappedRow.contact_notes,
    payment_plan_frequency: mappedRow.payment_plan_frequency,
    payment_frequency: mappedRow.payment_frequency,
    
    // Payment tracking fields
    total_payments: parseFloat(mappedRow.total_payments) || 0,
    payment_count: parseInt(mappedRow.payment_count) || 0,
    average_payment: mappedRow.average_payment ? parseFloat(mappedRow.average_payment) : null,
    largest_payment: mappedRow.largest_payment ? parseFloat(mappedRow.largest_payment) : null,
    
    // Compliance and flags
    do_not_call: mappedRow.do_not_call === 'true' || mappedRow.do_not_call === true,
    hardship_declared: mappedRow.hardship_declared === 'true' || mappedRow.hardship_declared === true,
    hardship_type: mappedRow.hardship_type,
    settlement_accepted: mappedRow.settlement_accepted === 'true' || mappedRow.settlement_accepted === true,
    
    // Data quality and source fields
    data_source: mappedRow.data_source,
    skip_trace_quality_score: mappedRow.skip_trace_quality_score ? parseFloat(mappedRow.skip_trace_quality_score) : null,
    notes: mappedRow.notes,
    
    // Bank information
    original_bank_name: mappedRow.original_bank_name || '',
    original_bank_routing_number: mappedRow.original_routing_number || '',
    original_bank_account_number: mappedRow.original_account_number_bank || '',
    
    // Foreign keys
    portfolio_id: portfolio.id,
    client_id: portfolio.client_id,
    created_by: platformUser.id,
    
    // Timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  return { personData, debtorData }
} 