import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'
import { sanitizeString, sanitizeEmail, sanitizePhone, sanitizeAddress, containsSqlInjection } from '@/lib/validation'
import { sendImportJobCompletedEmail } from '@/lib/email'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

// Simple validation function for import data
function validateImportData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check for SQL injection patterns
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && containsSqlInjection(value)) {
      errors.push(`Potential SQL injection detected in field ${key}`)
    }
  }
  
  return { isValid: errors.length === 0, errors }
}

// Simple sanitization function for import data
function sanitizeImportData(data: any): any {
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

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

    // Check if user has permission to view import jobs
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user', 'buyer']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
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
    if (user.activeRole.roleType !== 'platform_admin') {
      if (user.activeRole.organizationId) {
        query = query.eq('agency_id', user.activeRole.organizationId)
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
  console.log('🔍 Import API: Starting POST request')
  try {
    console.log('🔍 Import API: Authenticating request...')
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to create import jobs
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user', 'buyer']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    console.log('✅ Import API: Supabase admin client created')

    console.log('🔍 Import API: Parsing FormData...')
    const formData = await request.formData()
    console.log('✅ Import API: FormData parsed successfully')
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
    console.log('🔍 Import: Creating import job...')
    console.log('🔍 Import: Job data:', {
      user_id: user.auth_user_id,
      file_name: file.name,
      file_size: file.size,
      file_type: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
      import_type: importType,
      template_id: templateId || null,
      agency_id: user.activeRole.organizationId || null
    })
    
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
        agency_id: user.activeRole.organizationId || null
      })
      .select()
      .single()

    if (jobError) {
      console.error('❌ Import: Error creating import job:', jobError)
      return NextResponse.json(
        { error: `Failed to create import job: ${jobError.message}` },
        { status: 500 }
      )
    }
    
    console.log('✅ Import: Import job created successfully:', job.id)

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
    console.log('🔍 Import: Starting file upload to storage...')
    console.log('🔍 Import: File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: user.id,
      jobId: job.id
    })
    
    const fileBuffer = await file.arrayBuffer()
    console.log('🔍 Import: File buffer created, size:', fileBuffer.byteLength)
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('import-files')
        .upload(`${user.id}/${job.id}/${file.name}`, fileBuffer, {
          contentType: file.type,
          upsert: true
        })

      if (uploadError) {
        console.error('❌ Import: Error uploading file to storage:', uploadError)
        // Clean up the import job if file upload fails
        await supabase
          .from('import_jobs')
          .delete()
          .eq('id', job.id)
        
        return NextResponse.json(
          { error: `Failed to upload file to storage: ${uploadError.message}` },
          { status: 500 }
        )
      }
      
      console.log('✅ Import: File uploaded successfully to storage')
    } catch (uploadException) {
      console.error('❌ Import: Exception during file upload:', uploadException)
      // Clean up the import job if file upload fails
      await supabase
        .from('import_jobs')
        .delete()
        .eq('id', job.id)
      
      return NextResponse.json(
        { error: `File upload failed: ${uploadException instanceof Error ? uploadException.message : 'Unknown error'}` },
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
    console.error('❌ Import API: Unexpected error:', error)
    console.error('❌ Import API: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
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
    const allowedRoles = ['platform_admin', 'agency_admin', 'client_admin']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete import jobs' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
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
    if (user.activeRole.roleType !== 'platform_admin' && user.activeRole.organizationId !== job.agency_id) {
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

    // 1. Get all person IDs from debt accounts in this import job
    const { data: debtAccounts, error: debtAccountsError } = await supabase
      .from('debt_accounts')
      .select('person_id')
      .eq('import_batch_id', jobId)

    if (debtAccountsError) {
      console.error('Error fetching debt accounts:', debtAccountsError)
      return NextResponse.json(
        { error: 'Failed to fetch debt accounts' },
        { status: 500 }
      )
    }

    const personIds = debtAccounts.map(d => d.person_id).filter(id => id !== null)

    // 2. Delete all debt accounts from this import job
    const { error: debtAccountsDeleteError } = await supabase
      .from('debt_accounts')
      .delete()
      .eq('import_batch_id', jobId)

    if (debtAccountsDeleteError) {
      console.error('Error deleting debt accounts:', debtAccountsDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete debt accounts' },
        { status: 500 }
      )
    }

    // 3. Delete persons ONLY if they have no remaining debt accounts and no payments
    if (personIds.length > 0) {
      // Get all person IDs that are still referenced by other debt accounts
      const { data: remainingDebtAccounts } = await supabase
        .from('debt_accounts')
        .select('person_id')
        .in('person_id', personIds)

      // Get all debt account IDs for these persons
      const { data: debtAccountsForPersons } = await supabase
        .from('debt_accounts')
        .select('id, person_id')
        .in('person_id', personIds)

      const debtAccountIds = debtAccountsForPersons?.map(d => d.id) || []

      // Get all person IDs that have payments through their debt accounts
      const { data: debtorsWithPayments } = await supabase
        .from('debtor_payments')
        .select('debtor_id')
        .in('debtor_id', debtAccountIds)

      const debtorsWithPaymentsIds = debtorsWithPayments?.map(p => p.debtor_id) || []
      const debtAccountsWithPayments = debtAccountsForPersons?.filter(d => debtorsWithPaymentsIds.includes(d.id)) || []
      const personIdsWithPayments = debtAccountsWithPayments.map(d => d.person_id).filter(id => id !== null)

      // Find person IDs that are safe to delete
      const remainingPersonIds = new Set([
        ...(remainingDebtAccounts?.map(d => d.person_id) || []),
        ...personIdsWithPayments
      ])

      const safeToDeletePersonIds = personIds.filter(id => !remainingPersonIds.has(id))

      if (safeToDeletePersonIds.length > 0) {
        const { error: personsDeleteError } = await supabase
          .from('persons')
          .delete()
          .in('id', safeToDeletePersonIds)

        if (personsDeleteError) {
          console.error('Error deleting persons:', personsDeleteError)
          // Don't fail the entire operation for this
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
    } else if (job.import_type === 'skip_trace') {
      // Use individual processing for skip trace with special handling
      // Use default field mapping for skip trace if none provided
      const effectiveFieldMapping = fieldMapping && Object.keys(fieldMapping).length > 0 
        ? fieldMapping 
        : DEFAULT_SKIP_TRACE_FIELD_MAPPING
      
      for (let i = 0; i < rows.length; i++) {
        let mappedRow = rows[i] // Declare outside try block for catch block access
        
        try {
          // Map row fields using fieldMapping
          mappedRow = {}
          for (const [targetField, fileColumn] of Object.entries(effectiveFieldMapping)) {
            mappedRow[targetField] = rows[i][fileColumn]
          }
          
          const result = await processSkipTraceRow(mappedRow, supabase, userId, effectiveFieldMapping, jobId)
          if (result.successful) {
            successfulRows++
          } else {
            failedRows++
            const errorMsg = `Row ${i + 1}: ${result.error}`
            console.error(`[SKIP_TRACE] ${errorMsg}`)
            
            // Store error details
            errors.push({
              row: i + 1,
              column: 'general',
              value: '',
              message: result.error || 'Unknown error',
              severity: 'error'
            })
            
            // Store failed row data for CSV export
            failedRowsData.push({
              row_number: i + 1,
              original_data: rows[i],
              mapped_data: mappedRow || rows[i],
              error_message: result.error || 'Unknown error',
              error_type: 'SkipTraceError'
            })
          }
        } catch (error: any) {
          failedRows++
          const errorMsg = `Row ${i + 1}: ${error.message}`
          console.error(`[SKIP_TRACE] ${errorMsg}`)
          
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
            error_type: error.name || 'SkipTraceError'
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

    // Send completion email notification
    try {
      // Get user details for email
      const { data: userDetails } = await supabase
        .from('platform_users')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      if (userDetails) {
        const status = failedRows === 0 ? 'completed' : 'completed_with_errors'
        const details = `Successfully processed ${successfulRows} rows${failedRows > 0 ? ` with ${failedRows} failed rows` : ''}. ${job.import_type} import completed.`
        
        await sendImportJobCompletedEmail(
          userDetails.email,
          userDetails.full_name,
          job.job_name || `Import Job ${jobId}`,
          status,
          details
        )
      }
    } catch (emailError) {
      console.error('Error sending import completion email:', emailError)
      // Don't fail the import if email fails
    }

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

    // Send failure email notification
    try {
      // Get user details for email
      const { data: userDetails } = await supabase
        .from('platform_users')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      if (userDetails) {
        const { data: job } = await supabase
          .from('import_jobs')
          .select('job_name, import_type')
          .eq('id', jobId)
          .single()

        const details = `Import job failed with error: ${error.message}. Please check the import logs for more details.`
        
        await sendImportJobCompletedEmail(
          userDetails.email,
          userDetails.full_name,
          job?.job_name || `Import Job ${jobId}`,
          'failed',
          details
        )
      }
    } catch (emailError) {
      console.error('Error sending import failure email:', emailError)
      // Don't fail the import if email fails
    }
    
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

// Helper function to format phone numbers
function formatPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null
  
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`
  }
  
  return phone.trim()
}

// Helper function to validate email addresses
function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

// Helper function to populate phone numbers
async function populatePhoneNumbers(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  const phoneFields = [
    { field: 'phone', type: 'mobile' },
    { field: 'home_phone', type: 'home' },
    { field: 'work_phone', type: 'work' },
    { field: 'cell_phone', type: 'mobile' },
    { field: 'mobile_phone', type: 'mobile' }
  ]

  for (const { field, type } of phoneFields) {
    const phoneValue = mappedRow[field]
    if (phoneValue) {
      const formattedPhone = formatPhoneNumber(phoneValue)
      if (formattedPhone) {
        // Check if phone number already exists for this person
        const { data: existingPhone } = await supabase
          .from('person_phones')
          .select('id')
          .eq('person_id', personId)
          .eq('number', formattedPhone)
          .single()

        if (!existingPhone) {
          await supabase
            .from('person_phones')
            .insert({
              person_id: personId,
              number: formattedPhone,
              phone_type: type,
              status: 'unknown',
              is_current: true,
              first_seen: new Date().toISOString().split('T')[0],
              last_seen: new Date().toISOString().split('T')[0],
              source: 'import'
            })
        }
      }
    }
  }
}

// Helper function to populate email addresses
async function populateEmails(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  const emailFields = [
    { field: 'email', type: 'personal' },
    { field: 'work_email', type: 'work' },
    { field: 'personal_email', type: 'personal' },
    { field: 'alternate_email', type: 'other' }
  ]

  for (const { field, type } of emailFields) {
    const emailValue = mappedRow[field]
    if (emailValue && isValidEmail(emailValue)) {
      const cleanEmail = emailValue.trim().toLowerCase()
      
      // Check if email already exists for this person
      const { data: existingEmail } = await supabase
        .from('person_emails')
        .select('id')
        .eq('person_id', personId)
        .eq('email', cleanEmail)
        .single()

      if (!existingEmail) {
        await supabase
          .from('person_emails')
          .insert({
            person_id: personId,
            email: cleanEmail,
            email_type: type,
            is_current: true,
            first_seen: new Date().toISOString().split('T')[0],
            last_seen: new Date().toISOString().split('T')[0],
            source: 'import'
          })
      }
    }
  }
}

// Helper function to populate addresses
async function populateAddresses(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  const addressFields = [
    { 
      address: mappedRow.address || mappedRow.street_address,
      city: mappedRow.city,
      state: mappedRow.state,
      zipcode: mappedRow.zipcode || mappedRow.zip,
      type: 'residential'
    },
    {
      address: mappedRow.mailing_address,
      city: mappedRow.mailing_city,
      state: mappedRow.mailing_state,
      zipcode: mappedRow.mailing_zipcode || mappedRow.mailing_zip,
      type: 'mailing'
    }
  ]

  for (const addr of addressFields) {
    if (addr.address && addr.city && addr.state) {
      const fullAddress = [
        addr.address,
        addr.city,
        addr.state,
        addr.zipcode
      ].filter(Boolean).join(', ')

      // Check if address already exists for this person
      const { data: existingAddress } = await supabase
        .from('person_addresses')
        .select('id')
        .eq('person_id', personId)
        .eq('full_address', fullAddress)
        .single()

      if (!existingAddress) {
        await supabase
          .from('person_addresses')
          .insert({
            person_id: personId,
            full_address: fullAddress,
            address_line1: addr.address,
            city: addr.city,
            state: addr.state,
            zipcode: addr.zipcode,
            address_type: addr.type,
            is_current: addr.type === 'residential',
            first_seen: new Date().toISOString().split('T')[0],
            last_seen: new Date().toISOString().split('T')[0],
            source: 'import'
          })
      }
    }
  }
}

// Helper function to populate employment information
async function populateEmployment(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  if (mappedRow.employer || mappedRow.employer_name) {
    const employerName = mappedRow.employer || mappedRow.employer_name
    const employerAddress = mappedRow.employer_address
    const employerPhone = mappedRow.employer_phone
    const position = mappedRow.position || mappedRow.job_title
    const startDate = parseDate(mappedRow.employment_start_date)

    // Check if employment record already exists
    const { data: existingEmployment } = await supabase
      .from('person_employments')
      .select('id')
      .eq('person_id', personId)
      .eq('employer_name', employerName)
      .single()

    if (!existingEmployment) {
      await supabase
        .from('person_employments')
        .insert({
          person_id: personId,
          employer_name: employerName,
          address: employerAddress,
          phone: employerPhone,
          position: position,
          start_date: startDate,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'import'
        })
    }
  }
}

// Helper function to populate vehicle information
async function populateVehicles(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  const vehicleFields = [
    {
      vin: mappedRow.vehicle_vin,
      make: mappedRow.vehicle_make,
      model: mappedRow.vehicle_model,
      year: mappedRow.vehicle_year,
      license_plate: mappedRow.vehicle_license_plate,
      state: mappedRow.vehicle_state
    },
    {
      vin: mappedRow.car_vin,
      make: mappedRow.car_make,
      model: mappedRow.car_model,
      year: mappedRow.car_year,
      license_plate: mappedRow.car_license_plate,
      state: mappedRow.car_state
    }
  ]

  for (const vehicle of vehicleFields) {
    if (vehicle.vin || (vehicle.make && vehicle.model)) {
      // Check if vehicle already exists for this person
      const existingQuery = vehicle.vin 
        ? supabase.from('person_vehicles').select('id').eq('person_id', personId).eq('vin', vehicle.vin)
        : supabase.from('person_vehicles').select('id').eq('person_id', personId).eq('make', vehicle.make).eq('model', vehicle.model).eq('year', vehicle.year)

      const { data: existingVehicle } = await existingQuery.single()

      if (!existingVehicle) {
        await supabase
          .from('person_vehicles')
          .insert({
            person_id: personId,
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year ? parseInt(vehicle.year) : null,
            license_plate: vehicle.license_plate,
            state: vehicle.state,
            first_seen: new Date().toISOString().split('T')[0],
            last_seen: new Date().toISOString().split('T')[0],
            source: 'import'
          })
      }
    }
  }
}

// Helper function to populate bankruptcy information
async function populateBankruptcies(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  if (mappedRow.bankruptcy_filed === 'true' || mappedRow.bankruptcy_filed === true) {
    const filingDate = parseDate(mappedRow.bankruptcy_filing_date)
    const dischargeDate = parseDate(mappedRow.bankruptcy_discharge_date)
    const caseNumber = mappedRow.bankruptcy_case_number
    const chapter = mappedRow.bankruptcy_chapter
    const court = mappedRow.bankruptcy_court

    // Check if bankruptcy record already exists
    const { data: existingBankruptcy } = await supabase
      .from('person_bankruptcies')
      .select('id')
      .eq('person_id', personId)
      .eq('case_number', caseNumber)
      .single()

    if (!existingBankruptcy) {
      await supabase
        .from('person_bankruptcies')
        .insert({
          person_id: personId,
          case_number: caseNumber,
          filing_date: filingDate,
          discharge_date: dischargeDate,
          chapter: chapter,
          court: court,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'import'
        })
    }
  }
}

// Helper function to populate all related data for a person
async function populateRelatedData(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  try {
    // Populate phone numbers
    await populatePhoneNumbers(personId, mappedRow, supabase)
    
    // Populate email addresses
    await populateEmails(personId, mappedRow, supabase)
    
    // Populate addresses
    await populateAddresses(personId, mappedRow, supabase)
    
    // Populate employment information
    await populateEmployment(personId, mappedRow, supabase)
    
    // Populate vehicle information
    await populateVehicles(personId, mappedRow, supabase)
    
    // Populate bankruptcy information
    await populateBankruptcies(personId, mappedRow, supabase)
    
  } catch (error) {
    console.error(`[RELATED_DATA] Error populating related data for person ${personId}:`, error)
    // Don't throw error - related data population should not fail the main import
  }
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
    case 'skip_trace':
      await processSkipTraceRow(row, supabase, userId, fieldMapping, jobId)
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
        .from('debt_accounts')
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
        .from('debt_accounts')
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
      ssn: formattedSSN, // Keep SSN in debtors as account info
      
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
      created_by: platformUser.id,
      person_id: '' // Will be populated after person creation
    }

    // Create or find person record first
    let personId: string
    
    // Check if person already exists by SSN
    const { data: existingPerson, error: personLookupError } = await supabase
      .from('persons')
      .select('id')
      .eq('ssn', formattedSSN)
      .single()

    if (personLookupError && personLookupError.code !== 'PGRST116') {
      console.error(`[ACCOUNT] Person lookup error:`, personLookupError)
      throw new Error(`Person lookup failed: ${personLookupError.message}`)
    }

    if (existingPerson) {
      // Person exists, use their ID
      personId = existingPerson.id
      console.log(`[ACCOUNT] Found existing person with SSN ${formattedSSN}: ${personId}`)
      
      // Populate related data for existing person (in case new data is available)
      await populateRelatedData(personId, mappedRow, supabase)
    } else {
      // Create new person record
      const personData = {
        ssn: formattedSSN,
        first_name: mappedRow.first_name || '',
        last_name: mappedRow.last_name || '',
        middle_name: mappedRow.middle_name || '',
        full_name: `${mappedRow.first_name || ''} ${mappedRow.last_name || ''}`.trim(),
        dob: parseDate(mappedRow.date_of_birth),
        gender: mappedRow.gender,
        occupation: mappedRow.occupation,
        employer: mappedRow.employer,
        do_not_call: mappedRow.do_not_call === 'true' || mappedRow.do_not_call === true,
        do_not_mail: mappedRow.do_not_mail === 'true' || mappedRow.do_not_mail === true,
        do_not_email: mappedRow.do_not_email === 'true' || mappedRow.do_not_email === true,
        do_not_text: mappedRow.do_not_text === 'true' || mappedRow.do_not_text === true,
        bankruptcy_filed: mappedRow.bankruptcy_filed === 'true' || mappedRow.bankruptcy_filed === true,
        active_military: mappedRow.active_military === 'true' || mappedRow.active_military === true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Validate and sanitize person data
      const validationResult = validateImportData(personData)
      if (!validationResult.isValid) {
        throw new Error(`Person data validation failed: ${validationResult.errors.join(', ')}`)
      }

      const sanitizedPersonData = sanitizeImportData(personData)

      const { data: newPerson, error: personInsertError } = await supabase
        .from('persons')
        .insert(sanitizedPersonData)
        .select('id')
        .single()

      if (personInsertError) {
        console.error(`[ACCOUNT] Person creation error:`, personInsertError)
        throw new Error(`Failed to create person: ${personInsertError.message}`)
      }

      personId = newPerson.id
      console.log(`[ACCOUNT] Created new person with SSN ${formattedSSN}: ${personId}`)
      
      // Populate related data for new person
      await populateRelatedData(personId, mappedRow, supabase)
    }

    // Add person_id to debtor data
    debtorData.person_id = personId

    // Validate and sanitize debtor data
    const validationResult = validateImportData(debtorData)
    if (!validationResult.isValid) {
      throw new Error(`Debtor data validation failed: ${validationResult.errors.join(', ')}`)
    }

    const sanitizedDebtorData = sanitizeImportData(debtorData)

    // Create debtor (account) with new organized fields
    const { data: insertedDebtor, error } = await supabase
      .from('debt_accounts')
      .insert(sanitizedDebtorData)
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
      if (error.code === '23505' && error.message.includes('idx_debt_accounts_unique_account')) {
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
  const startTime = new Date()
  console.log(`[BULK_PROCESSING] Starting bulk processing for ${rows.length} rows`)
  
  let results: { successful: number, failed: number, errors: any[] }
  
  // Choose processing strategy based on dataset size
  if (rows.length > 1000) {
    // For very large datasets, use streaming processing with smaller batches
    console.log(`[BULK_PROCESSING] Large dataset detected (${rows.length} rows), using streaming processing`)
    results = await streamProcessBatch(rows, 50, supabase, userId, portfolioId, fieldMapping, jobId)
  } else if (rows.length > 100) {
    // For medium datasets, use standard batch processing
    console.log(`[BULK_PROCESSING] Medium dataset detected (${rows.length} rows), using standard batch processing`)
    results = await streamProcessBatch(rows, 100, supabase, userId, portfolioId, fieldMapping, jobId)
  } else {
    // For small datasets, use single batch processing
    console.log(`[BULK_PROCESSING] Small dataset detected (${rows.length} rows), using single batch processing`)
    results = await processAccountBatch(rows, supabase, userId, portfolioId, fieldMapping, jobId)
  }
  
  // Track performance metrics
  await trackImportPerformance(jobId, startTime, rows.length, results.successful, results.failed, supabase)
  
  console.log(`[BULK_PROCESSING] Bulk processing completed: ${results.successful} successful, ${results.failed} failed`)
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
  let insertedPersons: any[] | null = null
  if (personData.length > 0) {
    const { data: insertedPersonsData, error: personError } = await supabase
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
    } else {
      insertedPersons = insertedPersonsData
      // Update debtor records with correct person_id
      for (const debtor of debtorData) {
        if (debtor.person_id && debtor.person_id.startsWith('temp_')) {
          // Find the corresponding person by SSN
          const person = insertedPersons?.find((p: any) => p.ssn === debtor.ssn)
          if (person) {
            debtor.person_id = person.id
          }
        }
      }
    }
  }

  // For existing persons, we need to get their IDs
  const existingPersonSSNs = processedRows
    .filter(row => !row.personData) // Only rows where person already exists
    .map(row => row.debtorData.ssn)

  if (existingPersonSSNs.length > 0) {
    const { data: existingPersons } = await supabase
      .from('persons')
      .select('id, ssn')
      .in('ssn', existingPersonSSNs)

    if (existingPersons) {
      // Update debtor records with correct person_id for existing persons
      for (const debtor of debtorData) {
        if (debtor.person_id && debtor.person_id.startsWith('temp_')) {
          const person = existingPersons.find((p: any) => p.ssn === debtor.ssn)
          if (person) {
            debtor.person_id = person.id
          }
        }
      }
    }
  }
  
      // Bulk populate related data for all persons (both new and existing)
    try {
      // Create a map of SSN to person ID for easy lookup
      const ssnToPersonId = new Map<string, string>()
      
      // Add newly inserted persons
      if (insertedPersons) {
        for (const person of insertedPersons) {
          ssnToPersonId.set(person.ssn, person.id)
        }
      }
      
      // Add existing persons
      if (existingPersonSSNs.length > 0) {
        const { data: existingPersons } = await supabase
          .from('persons')
          .select('id, ssn')
          .in('ssn', existingPersonSSNs)
        
        if (existingPersons) {
          for (const person of existingPersons) {
            ssnToPersonId.set(person.ssn, person.id)
          }
        }
      }
      
      // Collect all related data for the batch
      console.log(`[BULK_PROCESSING] Collecting related data for ${batch.length} rows...`)
      const relatedData = await collectRelatedDataForBatch(batch, ssnToPersonId, fieldMapping)
      
      // Log collection results
      console.log(`[BULK_PROCESSING] Collected data:`, {
        phoneNumbers: relatedData.phoneNumbers.length,
        emails: relatedData.emails.length,
        addresses: relatedData.addresses.length,
        employment: relatedData.employment.length,
        vehicles: relatedData.vehicles.length,
        bankruptcies: relatedData.bankruptcies.length
      })
      
      // Bulk insert all related data
      if (relatedData.phoneNumbers.length > 0 || 
          relatedData.emails.length > 0 || 
          relatedData.addresses.length > 0 || 
          relatedData.employment.length > 0 || 
          relatedData.vehicles.length > 0 || 
          relatedData.bankruptcies.length > 0) {
        
        console.log(`[BULK_PROCESSING] Inserting related data...`)
        await bulkInsertRelatedData(relatedData, supabase)
        console.log(`[BULK_PROCESSING] Related data insertion completed`)
      }
      
    } catch (error: any) {
      console.error('[BULK_RELATED_DATA] Error in bulk related data population:', error)
      // Don't fail the entire batch for related data errors
    }
  
  // Bulk insert debtors
  if (debtorData.length > 0) {
    const { error: debtorError } = await supabase
      .from('debt_accounts')
      .insert(debtorData)
    
    if (debtorError) {
      console.error('Bulk debtor insert error:', debtorError)
      // Fall back to individual inserts if bulk fails
      for (const debtor of debtorData) {
        try {
          await supabase.from('debt_accounts').insert(debtor)
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
    .from('debt_accounts')
    .select('id')
    .eq('original_account_number', originalAccountNumber)
    .eq('ssn', formattedSSN)
    .eq('current_balance', currentBalance)
    .eq('portfolio_id', portfolio.id)

  if (existingDebtors && existingDebtors.length > 0) {
    return null // Skip duplicate in same portfolio
  }

  // Check if person already exists by SSN
  const { data: existingPerson } = await supabase
    .from('persons')
    .select('id')
    .eq('ssn', formattedSSN)
    .single()

  let personData: any = null
  let personId: string

  if (existingPerson) {
    // Person exists, use their ID
    personId = existingPerson.id
  } else {
    // Create new person record
    personData = {
      ssn: formattedSSN,
      first_name: mappedRow.first_name || '',
      last_name: mappedRow.last_name || '',
      middle_name: mappedRow.middle_name || '',
      full_name: `${mappedRow.first_name || ''} ${mappedRow.last_name || ''}`.trim(),
      dob: parseDate(mappedRow.date_of_birth),
      gender: mappedRow.gender,
      occupation: mappedRow.occupation,
      employer: mappedRow.employer,
      do_not_call: mappedRow.do_not_call === 'true' || mappedRow.do_not_call === true,
      do_not_mail: mappedRow.do_not_mail === 'true' || mappedRow.do_not_mail === true,
      do_not_email: mappedRow.do_not_email === 'true' || mappedRow.do_not_email === true,
      do_not_text: mappedRow.do_not_text === 'true' || mappedRow.do_not_text === true,
      bankruptcy_filed: mappedRow.bankruptcy_filed === 'true' || mappedRow.bankruptcy_filed === true,
      active_military: mappedRow.active_military === 'true' || mappedRow.active_military === true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Validate and sanitize person data
    const validationResult = validateImportData(personData)
    if (!validationResult.isValid) {
      throw new Error(`Person data validation failed: ${validationResult.errors.join(', ')}`)
    }

    personData = sanitizeImportData(personData)
    
    // For bulk processing, we'll need to get the person ID after insert
    // We'll use a temporary ID that will be replaced after the bulk insert
    personId = `temp_${Date.now()}_${Math.random()}`
  }

  // Prepare debtor data
  const debtorData = {
    // Account identification fields
    account_number: mappedRow.account_number || originalAccountNumber,
    original_account_number: originalAccountNumber,
    external_id: mappedRow.external_id,
    import_batch_id: jobId,
    ssn: formattedSSN, // Keep SSN in debtors as account info
    
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
    person_id: personId, // Link to person
    
    // Timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Validate and sanitize debtor data
  const validationResult = validateImportData(debtorData)
  if (!validationResult.isValid) {
    throw new Error(`Debtor data validation failed: ${validationResult.errors.join(', ')}`)
  }

  const sanitizedDebtorData = sanitizeImportData(debtorData)

  return { 
    personData: personData ? sanitizeImportData(personData) : undefined, 
    debtorData: sanitizedDebtorData 
  }
} 

// Helper function to populate relatives for skip trace
async function populateRelativesForSkipTrace(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  const relatives = [
    {
      name: mappedRow.rel1_full_name || `${mappedRow.rel1_first_name || ''} ${mappedRow.rel1_last_name || ''}`.trim(),
      relationship: mappedRow.rel1_likely_relationship,
      phone: mappedRow.rel1_phone_1,
      address: mappedRow.rel1_address,
      city: mappedRow.rel1_city,
      state: mappedRow.rel1_state,
      zipcode: mappedRow.rel1_zip,
      email: mappedRow.rel1_email_1,
      age: mappedRow.rel1_age
    },
    {
      name: mappedRow.rel2_full_name || `${mappedRow.rel2_first_name || ''} ${mappedRow.rel2_last_name || ''}`.trim(),
      relationship: mappedRow.rel2_likely_relationship,
      phone: mappedRow.rel2_phone_1,
      address: mappedRow.rel2_address,
      city: mappedRow.rel2_city,
      state: mappedRow.rel2_state,
      zipcode: mappedRow.rel2_zip,
      email: mappedRow.rel2_email_1,
      age: mappedRow.rel2_age
    },
    {
      name: mappedRow.rel3_full_name || `${mappedRow.rel3_first_name || ''} ${mappedRow.rel3_last_name || ''}`.trim(),
      relationship: mappedRow.rel3_likely_relationship,
      phone: mappedRow.rel3_phone_1,
      address: mappedRow.rel3_address,
      city: mappedRow.rel3_city,
      state: mappedRow.rel3_state,
      zipcode: mappedRow.rel3_zip,
      email: mappedRow.rel3_email_1,
      age: mappedRow.rel3_age
    },
    {
      name: mappedRow.rel4_full_name || `${mappedRow.rel4_first_name || ''} ${mappedRow.rel4_last_name || ''}`.trim(),
      relationship: mappedRow.rel4_likely_relationship,
      phone: mappedRow.rel4_phone_1,
      address: mappedRow.rel4_address,
      city: mappedRow.rel4_city,
      state: mappedRow.rel4_state,
      zipcode: mappedRow.rel4_zip,
      email: mappedRow.rel4_email_1,
      age: mappedRow.rel4_age
    },
    {
      name: mappedRow.rel5_full_name || `${mappedRow.rel5_first_name || ''} ${mappedRow.rel5_last_name || ''}`.trim(),
      relationship: mappedRow.rel5_likely_relationship,
      phone: mappedRow.rel5_phone_1,
      address: mappedRow.rel5_address,
      city: mappedRow.rel5_city,
      state: mappedRow.rel5_state,
      zipcode: mappedRow.rel5_zip,
      email: mappedRow.rel5_email_1,
      age: mappedRow.rel5_age
    }
  ]

  for (const relative of relatives) {
    if (relative.name && relative.name.trim() !== '') {
      // Check if relative already exists
      const { data: existingRelative } = await supabase
        .from('person_relatives')
        .select('id')
        .eq('person_id', personId)
        .eq('relative_name', relative.name.trim())
        .single()

      if (!existingRelative) {
        await supabase
          .from('person_relatives')
          .insert({
            person_id: personId,
            relative_name: relative.name.trim(),
            relationship: relative.relationship,
            relative_phone: relative.phone,
            address: relative.address,
            city: relative.city,
            state: relative.state,
            zipcode: relative.zipcode,
            relative_email: relative.email,
            first_seen: new Date().toISOString().split('T')[0],
            last_seen: new Date().toISOString().split('T')[0],
            source: 'skip_trace_import'
          })
      }
    }
  }
}

// Helper function to populate properties for skip trace
async function populatePropertiesForSkipTrace(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  const properties = [
    {
      address: mappedRow.property_address_full,
      city: mappedRow.property_city,
      state: mappedRow.property_state,
      zipcode: mappedRow.property_zip,
      county: mappedRow.property_county,
      market_value: mappedRow.market_value ? parseFloat(mappedRow.market_value) : null,
      purchase_date: parseDate(mappedRow.purchase_date),
      assessed_value: mappedRow.assessed_value ? parseFloat(mappedRow.assessed_value) : null,
      parcel_id: mappedRow.parcel_id_number
    },
    {
      address: mappedRow.prop2_address_full,
      city: mappedRow.prop2_city,
      state: mappedRow.prop2_state,
      zipcode: mappedRow.prop2_zip,
      county: mappedRow.prop2_county,
      market_value: mappedRow.prop2_market_value ? parseFloat(mappedRow.prop2_market_value) : null,
      purchase_date: parseDate(mappedRow.prop2_purchase_date),
      assessed_value: mappedRow.prop2_assessed_value ? parseFloat(mappedRow.prop2_assessed_value) : null,
      parcel_id: mappedRow.prop2_parcel_id_number
    },
    {
      address: mappedRow.prop3_address_full,
      city: mappedRow.prop3_city,
      state: mappedRow.prop3_state,
      zipcode: mappedRow.prop3_zip,
      county: mappedRow.prop3_county,
      market_value: mappedRow.prop3_market_value ? parseFloat(mappedRow.prop3_market_value) : null,
      purchase_date: parseDate(mappedRow.prop3_purchase_date),
      assessed_value: mappedRow.prop3_assessed_value ? parseFloat(mappedRow.prop3_assessed_value) : null,
      parcel_id: mappedRow.prop3_parcel_id_number
    }
  ]

  for (const property of properties) {
    if (property.address && property.address.trim() !== '') {
      // Check if property already exists
      const { data: existingProperty } = await supabase
        .from('person_properties')
        .select('id')
        .eq('person_id', personId)
        .eq('address', property.address.trim())
        .single()

      if (!existingProperty) {
        await supabase
          .from('person_properties')
          .insert({
            person_id: personId,
            address: property.address.trim(),
            city: property.city,
            state: property.state,
            zipcode: property.zipcode,
            county: property.county,
            property_value: property.market_value,
            estimated_value: property.assessed_value,
            purchase_date: property.purchase_date,
            parcel_id: property.parcel_id,
            first_seen: new Date().toISOString().split('T')[0],
            last_seen: new Date().toISOString().split('T')[0],
            source: 'skip_trace_import'
          })
      }
    }
  }
}

// Helper function to populate vehicles for skip trace
async function populateVehiclesForSkipTrace(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  if (mappedRow.vehicle_hit === 'Y' && (mappedRow.vehicle_vin || (mappedRow.vehicle_make && mappedRow.vehicle_model))) {
    // Check if vehicle already exists
    const existingQuery = mappedRow.vehicle_vin 
      ? supabase.from('person_vehicles').select('id').eq('person_id', personId).eq('vin', mappedRow.vehicle_vin)
      : supabase.from('person_vehicles').select('id').eq('person_id', personId).eq('make', mappedRow.vehicle_make).eq('model', mappedRow.vehicle_model).eq('year', mappedRow.vehicle_model_year ? parseInt(mappedRow.vehicle_model_year) : null)

    const { data: existingVehicle } = await existingQuery.single()

    if (!existingVehicle) {
      await supabase
        .from('person_vehicles')
        .insert({
          person_id: personId,
          vin: mappedRow.vehicle_vin,
          make: mappedRow.vehicle_make,
          model: mappedRow.vehicle_model,
          year: mappedRow.vehicle_model_year ? parseInt(mappedRow.vehicle_model_year) : null,
          license_plate: mappedRow.vehicle_plate_number,
          state: mappedRow.vehicle_plate_state,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'skip_trace_import'
        })
    }
  }
}

// Helper function to populate employment for skip trace
async function populateEmploymentForSkipTrace(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  if (mappedRow.poe_hit === 'Y' && mappedRow.poe_employer_name) {
    // Check if employment record already exists
    const { data: existingEmployment } = await supabase
      .from('person_employments')
      .select('id')
      .eq('person_id', personId)
      .eq('employer_name', mappedRow.poe_employer_name)
      .single()

    if (!existingEmployment) {
      await supabase
        .from('person_employments')
        .insert({
          person_id: personId,
          employer_name: mappedRow.poe_employer_name,
          address: mappedRow.poe_employer_address,
          city: mappedRow.poe_employer_city,
          state: mappedRow.poe_employer_state,
          zipcode: mappedRow.poe_employer_zip,
          phone: mappedRow.poe_employer_phone,
          position: mappedRow.poe_job_title,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'skip_trace_import'
        })
    }
  }
}

// Helper function to populate addresses for skip trace
async function populateAddressesForSkipTrace(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  if (mappedRow.address_hit === 'Y' && mappedRow.address1) {
    const fullAddress = [
      mappedRow.address1,
      mappedRow.address1_city,
      mappedRow.address1_state,
      mappedRow.address1_zip
    ].filter(Boolean).join(', ')

    // Check if address already exists for this person
    const { data: existingAddress } = await supabase
      .from('person_addresses')
      .select('id')
      .eq('person_id', personId)
      .eq('full_address', fullAddress)
      .single()

    if (!existingAddress) {
      await supabase
        .from('person_addresses')
        .insert({
          person_id: personId,
          full_address: fullAddress,
          address_line1: mappedRow.address1,
          city: mappedRow.address1_city,
          state: mappedRow.address1_state,
          zipcode: mappedRow.address1_zip,
          county: mappedRow.address1_county,
          address_type: 'residential',
          is_current: true,
          first_seen: mappedRow.address1_first_seen ? parseDate(mappedRow.address1_first_seen) : new Date().toISOString().split('T')[0],
          last_seen: mappedRow.address1_last_seen ? parseDate(mappedRow.address1_last_seen) : new Date().toISOString().split('T')[0],
          source: 'skip_trace_import'
        })
    }
  }
}

// Helper function to populate phones for skip trace
async function populatePhonesForSkipTrace(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  const phoneFields = [
    { field: 'phone1', type: mappedRow.phone1_type || 'mobile', firstSeen: mappedRow.phone1_first_seen, lastSeen: mappedRow.phone1_last_seen },
    { field: 'phone2', type: mappedRow.phone2_type || 'mobile', firstSeen: mappedRow.phone2_first_seen, lastSeen: mappedRow.phone2_last_seen },
    { field: 'phone3', type: mappedRow.phone3_type || 'mobile', firstSeen: mappedRow.phone3_first_seen, lastSeen: mappedRow.phone3_last_seen }
  ]

  for (const { field, type, firstSeen, lastSeen } of phoneFields) {
    const phoneValue = mappedRow[field]
    if (phoneValue && mappedRow.phone_hit === 'Y') {
      const formattedPhone = formatPhoneNumber(phoneValue)
      if (formattedPhone) {
              // Check if phone number already exists for this person
      const { data: existingPhone } = await supabase
        .from('person_phones')
        .select('id')
        .eq('person_id', personId)
        .eq('number', formattedPhone)
        .single()

      if (!existingPhone) {
        await supabase
          .from('person_phones')
            .insert({
              person_id: personId,
              number: formattedPhone,
              phone_type: type,
              status: 'unknown',
              is_current: true,
              first_seen: firstSeen ? parseDate(firstSeen) : new Date().toISOString().split('T')[0],
              last_seen: lastSeen ? parseDate(lastSeen) : new Date().toISOString().split('T')[0],
              source: 'skip_trace_import'
            })
        }
      }
    }
  }
}

// Helper function to populate all skip trace data for a person
async function populateSkipTraceData(
  personId: string, 
  mappedRow: any, 
  supabase: any
): Promise<void> {
  try {
    // Populate addresses
    await populateAddressesForSkipTrace(personId, mappedRow, supabase)
    
    // Populate phone numbers
    await populatePhonesForSkipTrace(personId, mappedRow, supabase)
    
    // Populate relatives
    await populateRelativesForSkipTrace(personId, mappedRow, supabase)
    
    // Populate properties
    await populatePropertiesForSkipTrace(personId, mappedRow, supabase)
    
    // Populate vehicles
    await populateVehiclesForSkipTrace(personId, mappedRow, supabase)
    
    // Populate employment
    await populateEmploymentForSkipTrace(personId, mappedRow, supabase)
    
    // Populate bankruptcy information (if available)
    if (mappedRow.bankrupt === 'Y' && mappedRow.case_number) {
      await populateBankruptcies(personId, mappedRow, supabase)
    }
    
  } catch (error) {
    console.error(`[SKIP_TRACE_DATA] Error populating skip trace data for person ${personId}:`, error)
    // Don't throw error - skip trace data population should not fail the main import
  }
}

// Process skip trace row
async function processSkipTraceRow(
  row: any, 
  supabase: any, 
  userId: string, 
  fieldMapping?: Record<string, string>, 
  jobId?: string
): Promise<{ successful: boolean; error?: string }> {
  try {
    let mappedRow = row
    
    // Map row fields if needed
    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      mappedRow = {}
      for (const [targetField, fileColumn] of Object.entries(fieldMapping)) {
        mappedRow[targetField] = row[fileColumn]
      }
    }

    // Validate required fields
    const formattedSSN = formatSSN(mappedRow.ssn)
    if (!formattedSSN) {
      throw new Error(`Invalid or missing SSN: ${mappedRow.ssn || 'null'}`)
    }

    // Find or create person
    let personId: string
    
    // Check if person exists
    const { data: existingPerson } = await supabase
      .from('persons')
      .select('id')
      .eq('ssn', formattedSSN)
      .single()

    if (existingPerson) {
      personId = existingPerson.id
      console.log(`[SKIP_TRACE] Found existing person with SSN ${formattedSSN}: ${personId}`)
    } else {
      // Create new person record
      const personData = {
        ssn: formattedSSN,
        first_name: mappedRow.first_name,
        last_name: mappedRow.last_name,
        full_name: `${mappedRow.first_name || ''} ${mappedRow.last_name || ''}`.trim(),
        is_deceased: mappedRow.deceased === 'Y'
      }

      const { data: newPerson, error: personError } = await supabase
        .from('persons')
        .insert(personData)
        .select('id')
        .single()

      if (personError) {
        throw new Error(`Failed to create person: ${personError.message}`)
      }

      personId = newPerson.id
      console.log(`[SKIP_TRACE] Created new person with SSN ${formattedSSN}: ${personId}`)
    }

    // Populate all skip trace data
    await populateSkipTraceData(personId, mappedRow, supabase)

    return { successful: true }
  } catch (error: any) {
    console.error('[SKIP_TRACE] Error processing skip trace row:', error)
    return { successful: false, error: error.message }
  }
}

// Default field mapping for skip trace imports
const DEFAULT_SKIP_TRACE_FIELD_MAPPING: Record<string, string> = {
  // Input fields
  'INPUT: Account Key': 'account_key',
  'INPUT: SSN': 'ssn',
  'INPUT: Last Name': 'last_name',
  'INPUT: First Name': 'first_name',
  'INPUT: Address 1': 'address_1',
  'INPUT: City': 'city',
  'INPUT: State': 'state',
  'INPUT: Zip Code': 'zip_code',
  'INPUT: Scrub Date': 'scrub_date',
  
  // Deceased information
  'DEC: Deceased (Y/N/U)': 'deceased',
  'DEC: IDI First Name': 'idi_first_name',
  'DEC: IDI Middle Name': 'idi_middle_name',
  'DEC: IDI Last Name': 'idi_last_name',
  'DEC: Residence Zip': 'residence_zip',
  'DEC: Last Payment Zip': 'last_payment_zip',
  'DEC: City': 'deceased_city',
  'DEC: State': 'deceased_state',
  'DEC: Verified/Proof': 'verified_proof',
  'DEC: SSDI First Name': 'ssdi_first_name',
  'DEC: SSDI Middle Name': 'ssdi_middle_name',
  'DEC: SSDI Last Name': 'ssdi_last_name',
  'DEC: SSDI Date of DEC': 'ssdi_date_of_dec',
  'DEC: OBIT First Name': 'obit_first_name',
  'DEC: OBIT Middle Name': 'obit_middle_name',
  'DEC: OBIT Last Name': 'obit_last_name',
  'DEC: Obit Date of DEC': 'obit_date_of_dec',
  
  // Bankruptcy information
  'BNK: Bankrupt (Y/N/U)': 'bankrupt',
  'BNK: Bankruptcy State': 'bankruptcy_state',
  'BNK: Case Number': 'case_number',
  'BNK: Filing Year': 'filing_year',
  'BNK: Filing Date': 'filing_date',
  'BNK: Chapter': 'chapter',
  'BNK: Internal Court Number': 'internal_court_number',
  'BNK: Debtor Type': 'debtor_type',
  'BNK: SSN': 'bankruptcy_ssn',
  'BNK: First Name': 'bankruptcy_first_name',
  'BNK: Middle Name': 'bankruptcy_middle_name',
  'BNK: Last Name': 'bankruptcy_last_name',
  'BNK: Generation': 'generation',
  'BNK: Link Code': 'link_code',
  'BNK: Address Full': 'address_full',
  'BNK: Street Number': 'street_number',
  'BNK: Street Direction': 'street_direction',
  'BNK: Street Name': 'street_name',
  'BNK: Street Type': 'street_type',
  'BNK: Address': 'address',
  'BNK: City': 'bankruptcy_city',
  'BNK: State': 'bankruptcy_state_2',
  'BNK: Zip': 'bankruptcy_zip',
  'BNK: CoDebtor First Name': 'codebtor_first_name',
  'BNK: CoDebtor Middle Name': 'codebtor_middle_name',
  'BNK: CoDebtor Last Name': 'codebtor_last_name',
  'BNK: CoDebtor Generation': 'codebtor_generation',
  'BNK: CoDebtor Address': 'codebtor_address',
  'BNK: CoDebtor City': 'codebtor_city',
  'BNK: CoDebtor State': 'codebtor_state',
  'BNK: CoDebtor Zip': 'codebtor_zip',
  'BNK: Discharged Date': 'discharged_date',
  'BNK: Dismissed Date': 'dismissed_date',
  'BNK: Closed Date': 'closed_date',
  'BNK: Hearing Date': 'hearing_date',
  'BNK: Assets': 'assets',
  'BNK: Debtor Key': 'debtor_key',
  'BNK: Case Voluntary': 'case_voluntary',
  'BNK: Trustee Name': 'trustee_name',
  'BNK: Trustee Address': 'trustee_address',
  'BNK: Trustee City': 'trustee_city',
  'BNK: Trustee State': 'trustee_state',
  'BNK: Trustee Zip': 'trustee_zip',
  'BNK: Trustee Phone': 'trustee_phone',
  'BNK: Hearing Time': 'hearing_time',
  'BNK: Hearing Address1': 'hearing_address1',
  'BNK: Hearing Address2': 'hearing_address2',
  'BNK: Hearing City': 'hearing_city',
  'BNK: Hearing State': 'hearing_state',
  'BNK: Hearing Zip': 'hearing_zip',
  'BNK: Judge Name': 'judge_name',
  'BNK: Judge Initials': 'judge_initials',
  'BNK: Individual Join': 'individual_join',
  'BNK: Prev Ch. Number': 'prev_ch_number',
  'BNK: Chapter Conversion Date': 'chapter_conversion_date',
  'BNK: Proof of Claim Date': 'proof_of_claim_date',
  'BNK: Objection To Plan Date': 'objection_to_plan_date',
  'BNK: Attorney Name': 'attorney_name',
  'BNK: Attorney FirmName': 'attorney_firm_name',
  'BNK: Attorney Address1': 'attorney_address1',
  'BNK: Attorney Address2': 'attorney_address2',
  'BNK: Attorney City': 'attorney_city',
  'BNK: Attorney State': 'attorney_state',
  'BNK: Attorney Zip': 'attorney_zip',
  'BNK: Attorney Phone': 'attorney_phone',
  'BNK: Court District': 'court_district',
  'BNK: Court Venue': 'court_venue',
  'BNK: Court Address1': 'court_address1',
  'BNK: Court Address2': 'court_address2',
  'BNK: Court City': 'court_city',
  'BNK: Court State': 'court_state',
  'BNK: Court Zip': 'court_zip',
  'BNK: Court Phone': 'court_phone',
  'BNK: ReInstated': 'reinstated',
  'BNK: ReInstate Date': 'reinstate_date',
  'BNK: Disposition Status': 'disposition_status',
  
  // Address information
  'ADD: Address (Y/N/U)': 'address_hit',
  'ADD: Address1': 'address1',
  'ADD: Address1 City': 'address1_city',
  'ADD: Address1 State': 'address1_state',
  'ADD: Address1 Zip': 'address1_zip',
  'ADD: Address1 County': 'address1_county',
  'ADD: Address1 First Seen': 'address1_first_seen',
  'ADD: Address1 Last Seen': 'address1_last_seen',
  
  // Phone information
  'PH: Phone (Y/N/U)': 'phone_hit',
  'PH: Phone1': 'phone1',
  'PH: Phone1 Type': 'phone1_type',
  'PH: Phone1 First Seen': 'phone1_first_seen',
  'PH: Phone1 Last Seen': 'phone1_last_seen',
  'PH: Phone2': 'phone2',
  'PH: Phone2 Type': 'phone2_type',
  'PH: Phone2 First Seen': 'phone2_first_seen',
  'PH: Phone2 Last Seen': 'phone2_last_seen',
  'PH: Phone3': 'phone3',
  'PH: Phone3 Type': 'phone3_type',
  'PH: Phone3 First Seen': 'phone3_first_seen',
  'PH: Phone3 Last Seen': 'phone3_last_seen',
  
  // Property information
  'PROP: Property (Y/N/U)': 'property_hit',
  'PROP: Parcel ID Number': 'parcel_id_number',
  'PROP: PID': 'pid',
  'PROP: First Name': 'property_first_name',
  'PROP: Middle Initial': 'property_middle_initial',
  'PROP: Last Name': 'property_last_name',
  'PROP: Owner2 First Name': 'owner2_first_name',
  'PROP: Owner2 Middle Initial': 'owner2_middle_initial',
  'PROP: Owner2 Last Name': 'owner2_last_name',
  'PROP: Spouse First Name': 'spouse_first_name',
  'PROP: Spouse Middle Name': 'spouse_middle_name',
  'PROP: Spouse Last Name': 'spouse_last_name',
  'PROP: Address Full': 'property_address_full',
  'PROP: Address Number': 'property_address_number',
  'PROP: Address Directional': 'property_address_directional',
  'PROP: Street': 'property_street',
  'PROP: Street Suffix': 'property_street_suffix',
  'PROP: Post Directional': 'property_post_directional',
  'PROP: Unit Designator': 'property_unit_designator',
  'PROP: Unit Number': 'property_unit_number',
  'PROP: City': 'property_city',
  'PROP: State': 'property_state',
  'PROP: Zip': 'property_zip',
  'PROP: County': 'property_county',
  'PROP: Mail Address Full': 'property_mail_address_full',
  'PROP: Mail Address Number': 'property_mail_address_number',
  'PROP: Mail Address Directional': 'property_mail_address_directional',
  'PROP: Mail Street': 'property_mail_street',
  'PROP: Mail Street Suffix': 'property_mail_street_suffix',
  'PROP: Mail Post Directional': 'property_mail_post_directional',
  'PROP: Mail Unit Designator': 'property_mail_unit_designator',
  'PROP: Mail Unit Number': 'property_mail_unit_number',
  'PROP: Mail City': 'property_mail_city',
  'PROP: Mail State': 'property_mail_state',
  'PROP: Mail Zip': 'property_mail_zip',
  'PROP: Loan Amount 1': 'loan_amount_1',
  'PROP: Lender 1': 'lender_1',
  'PROP: Lender Type 1': 'lender_type_1',
  'PROP: Loan Amount 2': 'loan_amount_2',
  'PROP: Lender 2': 'lender_2',
  'PROP: Lender Type 2': 'lender_type_2',
  'PROP: Loan Amount 3': 'loan_amount_3',
  'PROP: Lender 3': 'lender_3',
  'PROP: Lender Type 3': 'lender_type_3',
  'PROP: Purchase Amount': 'purchase_amount',
  'PROP: Purchase Date': 'purchase_date',
  'PROP: Assessed Date': 'assessed_date',
  'PROP: Filing Date': 'property_filing_date',
  'PROP: Lot Size': 'lot_size',
  'PROP: Assessed Value': 'assessed_value',
  'PROP: Market Value': 'market_value',
  'PROP: Square Feet': 'square_feet',
  
  // Additional properties (Prop2, Prop3) - mapping continues for all prop2 and prop3 fields
  'PROP: Prop2 Parcel ID Number': 'prop2_parcel_id_number',
  'PROP: Prop2 First Name': 'prop2_first_name',
  'PROP: Prop2 Middle Initial': 'prop2_middle_initial',
  'PROP: Prop2 Last Name': 'prop2_last_name',
  'PROP: Prop2 Owner2 First Name': 'prop2_owner2_first_name',
  'PROP: Prop2 Owner2 Middle Initial': 'prop2_owner2_middle_initial',
  'PROP: Prop2 Owner2 Last Name': 'prop2_owner2_last_name',
  'PROP: Prop2 Spouse First Name': 'prop2_spouse_first_name',
  'PROP: Prop2 Spouse Middle Name': 'prop2_spouse_middle_name',
  'PROP: Prop2 Spouse Last Name': 'prop2_spouse_last_name',
  'PROP: Prop2 Address Full': 'prop2_address_full',
  'PROP: Prop2 Address Number': 'prop2_address_number',
  'PROP: Prop2 Address Directional': 'prop2_address_directional',
  'PROP: Prop2 Street': 'prop2_street',
  'PROP: Prop2 Street Suffix': 'prop2_street_suffix',
  'PROP: Prop2 Post Directional': 'prop2_post_directional',
  'PROP: Prop2 Unit Designator': 'prop2_unit_designator',
  'PROP: Prop2 Unit Number': 'prop2_unit_number',
  'PROP: Prop2 City': 'prop2_city',
  'PROP: Prop2 State': 'prop2_state',
  'PROP: Prop2 Zip': 'prop2_zip',
  'PROP: Prop2 County': 'prop2_county',
  'PROP: Prop2 Mail Address Full': 'prop2_mail_address_full',
  'PROP: Prop2 Mail Address Number': 'prop2_mail_address_number',
  'PROP: Prop2 Mail Address Directional': 'prop2_mail_address_directional',
  'PROP: Prop2 Mail Street': 'prop2_mail_street',
  'PROP: Prop2 Mail Street Suffix': 'prop2_mail_street_suffix',
  'PROP: Prop2 Mail Post Directional': 'prop2_mail_post_directional',
  'PROP: Prop2 Mail Unit Designator': 'prop2_mail_unit_designator',
  'PROP: Prop2 Mail Unit Number': 'prop2_mail_unit_number',
  'PROP: Prop2 Mail City': 'prop2_mail_city',
  'PROP: Prop2 Mail State': 'prop2_mail_state',
  'PROP: Prop2 Mail Zip': 'prop2_mail_zip',
  'PROP: Prop2 Loan Amount 1': 'prop2_loan_amount_1',
  'PROP: Prop2 Lender 1': 'prop2_lender_1',
  'PROP: Prop2 Lender Type 1': 'prop2_lender_type_1',
  'PROP: Prop2 Loan Amount 2': 'prop2_loan_amount_2',
  'PROP: Prop2 Lender 2': 'prop2_lender_2',
  'PROP: Prop2 Lender Type 2': 'prop2_lender_type_2',
  'PROP: Prop2 Loan Amount 3': 'prop2_loan_amount_3',
  'PROP: Prop2 Lender 3': 'prop2_lender_3',
  'PROP: Prop2 Lender Type 3': 'prop2_lender_type_3',
  'PROP: Prop2 Purchase Amount': 'prop2_purchase_amount',
  'PROP: Prop2 Purchase Date': 'prop2_purchase_date',
  'PROP: Prop2 Assessed Date': 'prop2_assessed_date',
  'PROP: Prop2 Filing Date': 'prop2_filing_date',
  'PROP: Prop2 Lot Size': 'prop2_lot_size',
  'PROP: Prop2 Assessed Value': 'prop2_assessed_value',
  'PROP: Prop2 Market Value': 'prop2_market_value',
  'PROP: Prop2 Square Feet': 'prop2_square_feet',
  
  'PROP: Prop3 Parcel ID Number': 'prop3_parcel_id_number',
  'PROP: Prop3 First Name': 'prop3_first_name',
  'PROP: Prop3 Middle Initial': 'prop3_middle_initial',
  'PROP: Prop3 Last Name': 'prop3_last_name',
  'PROP: Prop3 Owner2 First Name': 'prop3_owner2_first_name',
  'PROP: Prop3 Owner2 Middle Initial': 'prop3_owner2_middle_initial',
  'PROP: Prop3 Owner2 Last Name': 'prop3_owner2_last_name',
  'PROP: Prop3 Spouse First Name': 'prop3_spouse_first_name',
  'PROP: Prop3 Spouse Middle Name': 'prop3_spouse_middle_name',
  'PROP: Prop3 Spouse Last Name': 'prop3_spouse_last_name',
  'PROP: Prop3 Address Full': 'prop3_address_full',
  'PROP: Prop3 Address Number': 'prop3_address_number',
  'PROP: Prop3 Address Directional': 'prop3_address_directional',
  'PROP: Prop3 Street': 'prop3_street',
  'PROP: Prop3 Street Suffix': 'prop3_street_suffix',
  'PROP: Prop3 Post Directional': 'prop3_post_directional',
  'PROP: Prop3 Unit Designator': 'prop3_unit_designator',
  'PROP: Prop3 Unit Number': 'prop3_unit_number',
  'PROP: Prop3 City': 'prop3_city',
  'PROP: Prop3 State': 'prop3_state',
  'PROP: Prop3 Zip': 'prop3_zip',
  'PROP: Prop3 County': 'prop3_county',
  'PROP: Prop3 Mail Address Full': 'prop3_mail_address_full',
  'PROP: Prop3 Mail Address Number': 'prop3_mail_address_number',
  'PROP: Prop3 Mail Address Directional': 'prop3_mail_address_directional',
  'PROP: Prop3 Mail Street': 'prop3_mail_street',
  'PROP: Prop3 Mail Street Suffix': 'prop3_mail_street_suffix',
  'PROP: Prop3 Mail Post Directional': 'prop3_mail_post_directional',
  'PROP: Prop3 Mail Unit Designator': 'prop3_mail_unit_designator',
  'PROP: Prop3 Mail Unit Number': 'prop3_mail_unit_number',
  'PROP: Prop3 Mail City': 'prop3_mail_city',
  'PROP: Prop3 Mail State': 'prop3_mail_state',
  'PROP: Prop3 Mail Zip': 'prop3_mail_zip',
  'PROP: Prop3 Loan Amount 1': 'prop3_loan_amount_1',
  'PROP: Prop3 Lender 1': 'prop3_lender_1',
  'PROP: Prop3 Lender Type 1': 'prop3_lender_type_1',
  'PROP: Prop3 Loan Amount 2': 'prop3_loan_amount_2',
  'PROP: Prop3 Lender 2': 'prop3_lender_2',
  'PROP: Prop3 Lender Type 2': 'prop3_lender_type_2',
  'PROP: Prop3 Loan Amount 3': 'prop3_loan_amount_3',
  'PROP: Prop3 Lender 3': 'prop3_lender_3',
  'PROP: Prop3 Lender Type 3': 'prop3_lender_type_3',
  'PROP: Prop3 Purchase Amount': 'prop3_purchase_amount',
  'PROP: Prop3 Purchase Date': 'prop3_purchase_date',
  'PROP: Prop3 Assessed Date': 'prop3_assessed_date',
  'PROP: Prop3 Filing Date': 'prop3_filing_date',
  'PROP: Prop3 Lot Size': 'prop3_lot_size',
  'PROP: Prop3 Assessed Value': 'prop3_assessed_value',
  'PROP: Prop3 Market Value': 'prop3_market_value',
  'PROP: Prop3 Square Feet': 'prop3_square_feet',
  
  // Relatives information
  'REL: Hit (Y/N/U)': 'relatives_hit',
  'REL1: First Name': 'rel1_first_name',
  'REL1: Middle Name': 'rel1_middle_name',
  'REL1: Last Name': 'rel1_last_name',
  'REL1: Suffix': 'rel1_suffix',
  'REL1: Full Name': 'rel1_full_name',
  'REL1: Address': 'rel1_address',
  'REL1: City': 'rel1_city',
  'REL1: State': 'rel1_state',
  'REL1: Zip': 'rel1_zip',
  'REL1: Age': 'rel1_age',
  'REL1: Phone 1': 'rel1_phone_1',
  'REL1: Phone 2': 'rel1_phone_2',
  'REL1: Phone 3': 'rel1_phone_3',
  'REL1: Email 1': 'rel1_email_1',
  'REL1: Email 2': 'rel1_email_2',
  'REL1: Email 3': 'rel1_email_3',
  'REL1: Likely Relationship': 'rel1_likely_relationship',
  
  'REL2: First Name': 'rel2_first_name',
  'REL2: Middle Name': 'rel2_middle_name',
  'REL2: Last Name': 'rel2_last_name',
  'REL2: Suffix': 'rel2_suffix',
  'REL2: Full Name': 'rel2_full_name',
  'REL2: Address': 'rel2_address',
  'REL2: City': 'rel2_city',
  'REL2: State': 'rel2_state',
  'REL2: Zip': 'rel2_zip',
  'REL2: Age': 'rel2_age',
  'REL2: Phone 1': 'rel2_phone_1',
  'REL2: Phone 2': 'rel2_phone_2',
  'REL2: Phone 3': 'rel2_phone_3',
  'REL2: Email 1': 'rel2_email_1',
  'REL2: Email 2': 'rel2_email_2',
  'REL2: Email 3': 'rel2_email_3',
  'REL2: Likely Relationship': 'rel2_likely_relationship',
  
  'REL3: First Name': 'rel3_first_name',
  'REL3: Middle Name': 'rel3_middle_name',
  'REL3: Last Name': 'rel3_last_name',
  'REL3: Suffix': 'rel3_suffix',
  'REL3: Full Name': 'rel3_full_name',
  'REL3: Address': 'rel3_address',
  'REL3: City': 'rel3_city',
  'REL3: State': 'rel3_state',
  'REL3: Zip': 'rel3_zip',
  'REL3: Age': 'rel3_age',
  'REL3: Phone 1': 'rel3_phone_1',
  'REL3: Phone 2': 'rel3_phone_2',
  'REL3: Phone 3': 'rel3_phone_3',
  'REL3: Email 1': 'rel3_email_1',
  'REL3: Email 2': 'rel3_email_2',
  'REL3: Email 3': 'rel3_email_3',
  'REL3: Likely Relationship': 'rel3_likely_relationship',
  
  'REL4: First Name': 'rel4_first_name',
  'REL4: Middle Name': 'rel4_middle_name',
  'REL4: Last Name': 'rel4_last_name',
  'REL4: Suffix': 'rel4_suffix',
  'REL4: Full Name': 'rel4_full_name',
  'REL4: Address': 'rel4_address',
  'REL4: City': 'rel4_city',
  'REL4: State': 'rel4_state',
  'REL4: Zip': 'rel4_zip',
  'REL4: Age': 'rel4_age',
  'REL4: Phone 1': 'rel4_phone_1',
  'REL4: Phone 2': 'rel4_phone_2',
  'REL4: Phone 3': 'rel4_phone_3',
  'REL4: Email 1': 'rel4_email_1',
  'REL4: Email 2': 'rel4_email_2',
  'REL4: Email 3': 'rel4_email_3',
  'REL4: Likely Relationship': 'rel4_likely_relationship',
  
  'REL5: First Name': 'rel5_first_name',
  'REL5: Middle Name': 'rel5_middle_name',
  'REL5: Last Name': 'rel5_last_name',
  'REL5: Suffix': 'rel5_suffix',
  'REL5: Full Name': 'rel5_full_name',
  'REL5: Address': 'rel5_address',
  'REL5: City': 'rel5_city',
  'REL5: State': 'rel5_state',
  'REL5: Zip': 'rel5_zip',
  'REL5: Age': 'rel5_age',
  'REL5: Phone 1': 'rel5_phone_1',
  'REL5: Phone 2': 'rel5_phone_2',
  'REL5: Phone 3': 'rel5_phone_3',
  'REL5: Email 1': 'rel5_email_1',
  'REL5: Email 2': 'rel5_email_2',
  'REL5: Email 3': 'rel5_email_3',
  'REL5: Likely Relationship': 'rel5_likely_relationship',
  
  // Vehicle information
  'VEHICLE: Hit (Y/N)': 'vehicle_hit',
  'VEHICLE: Hit (Y/N/U)': 'vehicle_hit',
  'VEHICLE: Make': 'vehicle_make',
  'VEHICLE: Model': 'vehicle_model',
  'VEHICLE: Model Year': 'vehicle_model_year',
  'VEHICLE: Trim': 'vehicle_trim',
  'VEHICLE: VIN': 'vehicle_vin',
  'VEHICLE: Squished VIN': 'vehicle_squished_vin',
  'VEHICLE: Axles': 'vehicle_axles',
  'VEHICLE: Type': 'vehicle_type',
  'VEHICLE: Body Style': 'vehicle_body_style',
  'VEHICLE: Primary Color': 'vehicle_primary_color',
  'VEHICLE: Secondary Color': 'vehicle_secondary_color',
  'VEHICLE: Weight': 'vehicle_weight',
  'VEHICLE: Length': 'vehicle_length',
  'VEHICLE: Registrant Name': 'vehicle_registrant_name',
  'VEHICLE: Registrant Business Name': 'vehicle_registrant_business_name',
  'VEHICLE: Registrant Address': 'vehicle_registrant_address',
  'VEHICLE: Registrant Mail Address': 'vehicle_registrant_mail_address',
  'VEHICLE: Registrant Latest Address': 'vehicle_registrant_latest_address',
  'VEHICLE: Owner Name': 'vehicle_owner_name',
  'VEHICLE: Owner DOB': 'vehicle_owner_dob',
  'VEHICLE: Owner Business Name': 'vehicle_owner_business_name',
  'VEHICLE: Owner Address': 'vehicle_owner_address',
  'VEHICLE: Owner Mail Address': 'vehicle_owner_mail_address',
  'VEHICLE: Owner Latest Address': 'vehicle_owner_latest_address',
  'VEHICLE: Lien Holder Name': 'vehicle_lien_holder_name',
  'VEHICLE: Lien Business Name': 'vehicle_lien_business_name',
  'VEHICLE: Lien Holder Address': 'vehicle_lien_holder_address',
  'VEHICLE: Lien Holder Mail Address': 'vehicle_lien_holder_mail_address',
  'VEHICLE: Lien Holder Latest Address': 'vehicle_lien_holder_latest_address',
  'VEHICLE: Lessor Name': 'vehicle_lessor_name',
  'VEHICLE: Lessor Business Name': 'vehicle_lessor_business_name',
  'VEHICLE: Lessor Address': 'vehicle_lessor_address',
  'VEHICLE: Lessor Mail Address': 'vehicle_lessor_mail_address',
  'VEHICLE: Lessor Latest Address': 'vehicle_lessor_latest_address',
  'VEHICLE: Plate Number': 'vehicle_plate_number',
  'VEHICLE: Plate State': 'vehicle_plate_state',
  'VEHICLE: Plate Type': 'vehicle_plate_type',
  'VEHICLE: Plate Expiration Date': 'vehicle_plate_expiration_date',
  'VEHICLE: Plate Decal': 'vehicle_plate_decal',
  'VEHICLE: Previous Plate Number': 'vehicle_previous_plate_number',
  'VEHICLE: Plate First Seen Date': 'vehicle_plate_first_seen_date',
  'VEHICLE: Previous Plate State': 'vehicle_previous_plate_state',
  'VEHICLE: Plate Last Seen Date': 'vehicle_plate_last_seen_date',
  'VEHICLE: Previous Plate Type': 'vehicle_previous_plate_type',
  'VEHICLE: Previous Expiration Date': 'vehicle_previous_expiration_date',
  'VEHICLE: Previous Plate Decal': 'vehicle_previous_plate_decal',
  'VEHICLE: Renewal Date': 'vehicle_renewal_date',
  'VEHICLE: Title Number': 'vehicle_title_number',
  'VEHICLE: Title Transfer Date': 'vehicle_title_transfer_date',
  'VEHICLE: Title Original Date': 'vehicle_title_original_date',
  'VEHICLE: Registration First Seen Date': 'vehicle_registration_first_seen_date',
  'VEHICLE: Registration Last Seen Date': 'vehicle_registration_last_seen_date',
  
  // Place of employment information
  'POE: Hit (Y/N/U)': 'poe_hit',
  'POE: Employer Name': 'poe_employer_name',
  'POE: Employer Phone': 'poe_employer_phone',
  'POE: Phone': 'poe_phone',
  'POE: Cell': 'poe_cell',
  'POE: Employer Address': 'poe_employer_address',
  'POE: Employer City': 'poe_employer_city',
  'POE: Employer State': 'poe_employer_state',
  'POE: Employer Zip': 'poe_employer_zip',
  'POE: Last Seen Date': 'poe_last_seen_date',
  'POE: Job Title': 'poe_job_title'
}

// Bulk collection functions for related data
async function collectRelatedDataForBatch(
  batch: any[], 
  ssnToPersonId: Map<string, string>,
  fieldMapping?: Record<string, string>
): Promise<{
  phoneNumbers: any[],
  emails: any[],
  addresses: any[],
  employment: any[],
  vehicles: any[],
  bankruptcies: any[]
}> {
  const phoneNumbers: any[] = []
  const emails: any[] = []
  const addresses: any[] = []
  const employment: any[] = []
  const vehicles: any[] = []
  const bankruptcies: any[] = []

  for (const row of batch) {
    let mappedRow = row
    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      mappedRow = {}
      for (const [targetField, fileColumn] of Object.entries(fieldMapping)) {
        mappedRow[targetField] = row[fileColumn]
      }
    }

    const formattedSSN = formatSSN(mappedRow.ssn)
    if (formattedSSN && ssnToPersonId.has(formattedSSN)) {
      const personId = ssnToPersonId.get(formattedSSN)!
      
      // Collect phone numbers
      const phoneFields = [
        { field: 'phone', type: 'mobile' },
        { field: 'home_phone', type: 'home' },
        { field: 'work_phone', type: 'work' },
        { field: 'cell_phone', type: 'mobile' },
        { field: 'mobile_phone', type: 'mobile' }
      ]
      
      for (const { field, type } of phoneFields) {
        const phoneValue = mappedRow[field]
        if (phoneValue) {
          const formattedPhone = formatPhoneNumber(phoneValue)
          if (formattedPhone) {
            phoneNumbers.push({
              person_id: personId,
              number: formattedPhone,
              phone_type: type,
              status: 'unknown',
              is_current: true,
              first_seen: new Date().toISOString().split('T')[0],
              last_seen: new Date().toISOString().split('T')[0],
              source: 'import'
            })
          }
        }
      }

      // Collect email addresses
      const emailFields = [
        { field: 'email', type: 'personal' },
        { field: 'work_email', type: 'work' },
        { field: 'secondary_email', type: 'personal' }
      ]
      
      for (const { field, type } of emailFields) {
        const emailValue = mappedRow[field]
        if (emailValue && isValidEmail(emailValue)) {
          emails.push({
            person_id: personId,
            email_address: emailValue.toLowerCase().trim(),
            email_type: type,
            is_current: true,
            first_seen: new Date().toISOString().split('T')[0],
            last_seen: new Date().toISOString().split('T')[0],
            source: 'import'
          })
        }
      }

      // Collect addresses
      if (mappedRow.address_line1 || mappedRow.address) {
        const fullAddress = [
          mappedRow.address_line1 || mappedRow.address,
          mappedRow.city,
          mappedRow.state,
          mappedRow.zipcode
        ].filter(Boolean).join(', ')

        addresses.push({
          person_id: personId,
          full_address: fullAddress,
          address_line1: mappedRow.address_line1 || mappedRow.address,
          address_line2: mappedRow.address_line2,
          city: mappedRow.city,
          state: mappedRow.state,
          zipcode: mappedRow.zipcode,
          county: mappedRow.county,
          address_type: 'residential',
          is_current: true,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'import'
        })
      }

      // Collect employment information
      if (mappedRow.employer || mappedRow.employer_name) {
        employment.push({
          person_id: personId,
          employer_name: mappedRow.employer || mappedRow.employer_name,
          address: mappedRow.employer_address,
          city: mappedRow.employer_city,
          state: mappedRow.employer_state,
          zipcode: mappedRow.employer_zipcode,
          phone: mappedRow.employer_phone,
          position: mappedRow.job_title || mappedRow.position,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'import'
        })
      }

      // Collect vehicle information
      if (mappedRow.vehicle_make || mappedRow.vehicle_model || mappedRow.vin) {
        vehicles.push({
          person_id: personId,
          vin: mappedRow.vin,
          make: mappedRow.vehicle_make || mappedRow.make,
          model: mappedRow.vehicle_model || mappedRow.model,
          year: mappedRow.vehicle_year || mappedRow.year ? parseInt(mappedRow.vehicle_year || mappedRow.year) : null,
          license_plate: mappedRow.license_plate || mappedRow.plate_number,
          state: mappedRow.vehicle_state || mappedRow.plate_state,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'import'
        })
      }

      // Collect bankruptcy information
      if (mappedRow.bankruptcy_filed === 'Y' || mappedRow.bankruptcy_case_number) {
        bankruptcies.push({
          person_id: personId,
          case_number: mappedRow.bankruptcy_case_number || mappedRow.case_number,
          filing_date: parseDate(mappedRow.bankruptcy_filing_date || mappedRow.filing_date),
          discharge_date: parseDate(mappedRow.bankruptcy_discharge_date || mappedRow.discharge_date),
          chapter: mappedRow.bankruptcy_chapter || mappedRow.chapter,
          court_district: mappedRow.bankruptcy_court || mappedRow.court,
          attorney_name: mappedRow.bankruptcy_attorney || mappedRow.attorney,
          amount: mappedRow.bankruptcy_amount ? parseFloat(mappedRow.bankruptcy_amount) : null,
          first_seen: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString().split('T')[0],
          source: 'import'
        })
      }
    }
  }

  return { phoneNumbers, emails, addresses, employment, vehicles, bankruptcies }
}

// Bulk insertion function for related data
async function bulkInsertRelatedData(
  relatedData: {
    phoneNumbers: any[],
    emails: any[],
    addresses: any[],
    employment: any[],
    vehicles: any[],
    bankruptcies: any[]
  },
  supabase: any
): Promise<void> {
  // Bulk insert phone numbers
  if (relatedData.phoneNumbers.length > 0) {
    try {
      await supabase
        .from('person_phones')
        .upsert(relatedData.phoneNumbers, { 
          onConflict: 'person_id,number',
          ignoreDuplicates: true 
        })
      console.log(`[BULK_INSERT] Inserted ${relatedData.phoneNumbers.length} phone numbers`)
    } catch (error) {
      console.error('[BULK_INSERT] Error inserting phone numbers:', error)
    }
  }

  // Bulk insert emails
  if (relatedData.emails.length > 0) {
    try {
      await supabase
        .from('person_emails')
        .upsert(relatedData.emails, { 
          onConflict: 'person_id,email_address',
          ignoreDuplicates: true 
        })
      console.log(`[BULK_INSERT] Inserted ${relatedData.emails.length} emails`)
    } catch (error) {
      console.error('[BULK_INSERT] Error inserting emails:', error)
    }
  }

  // Bulk insert addresses
  if (relatedData.addresses.length > 0) {
    try {
      await supabase
        .from('person_addresses')
        .upsert(relatedData.addresses, { 
          onConflict: 'person_id,full_address',
          ignoreDuplicates: true 
        })
      console.log(`[BULK_INSERT] Inserted ${relatedData.addresses.length} addresses`)
    } catch (error) {
      console.error('[BULK_INSERT] Error inserting addresses:', error)
    }
  }

  // Bulk insert employment
  if (relatedData.employment.length > 0) {
    try {
      await supabase
        .from('person_employments')
        .upsert(relatedData.employment, { 
          onConflict: 'person_id,employer_name',
          ignoreDuplicates: true 
        })
      console.log(`[BULK_INSERT] Inserted ${relatedData.employment.length} employment records`)
    } catch (error) {
      console.error('[BULK_INSERT] Error inserting employment:', error)
    }
  }

  // Bulk insert vehicles
  if (relatedData.vehicles.length > 0) {
    try {
      await supabase
        .from('person_vehicles')
        .upsert(relatedData.vehicles, { 
          onConflict: 'person_id,vin',
          ignoreDuplicates: true 
        })
      console.log(`[BULK_INSERT] Inserted ${relatedData.vehicles.length} vehicles`)
    } catch (error) {
      console.error('[BULK_INSERT] Error inserting vehicles:', error)
    }
  }

  // Bulk insert bankruptcies
  if (relatedData.bankruptcies.length > 0) {
    try {
      await supabase
        .from('person_bankruptcies')
        .upsert(relatedData.bankruptcies, { 
          onConflict: 'person_id,case_number',
          ignoreDuplicates: true 
        })
      console.log(`[BULK_INSERT] Inserted ${relatedData.bankruptcies.length} bankruptcies`)
    } catch (error) {
      console.error('[BULK_INSERT] Error inserting bankruptcies:', error)
    }
  }
}

// Enhanced duplicate detection for bulk operations
async function batchDuplicateDetection(
  personIds: string[],
  relatedData: {
    phoneNumbers: any[],
    emails: any[],
    addresses: any[],
    employment: any[],
    vehicles: any[],
    bankruptcies: any[]
  },
  supabase: any
): Promise<Set<string>> {
  const duplicateKeys = new Set<string>()

  try {
    // Batch check phone numbers
    if (relatedData.phoneNumbers.length > 0) {
      const phoneNumbers = relatedData.phoneNumbers.map((p: any) => p.number)
      const { data: existingPhones } = await supabase
        .from('person_phones')
        .select('person_id, number')
        .in('person_id', personIds)
        .in('number', phoneNumbers)

      existingPhones?.forEach((phone: any) => {
        duplicateKeys.add(`phone_${phone.person_id}_${phone.number}`)
      })
    }

    // Batch check emails
    if (relatedData.emails.length > 0) {
      const emails = relatedData.emails.map((e: any) => e.email_address)
      const { data: existingEmails } = await supabase
        .from('person_emails')
        .select('person_id, email_address')
        .in('person_id', personIds)
        .in('email_address', emails)

      existingEmails?.forEach((email: any) => {
        duplicateKeys.add(`email_${email.person_id}_${email.email_address}`)
      })
    }

    // Batch check addresses
    if (relatedData.addresses.length > 0) {
      const addresses = relatedData.addresses.map((a: any) => a.full_address)
      const { data: existingAddresses } = await supabase
        .from('person_addresses')
        .select('person_id, full_address')
        .in('person_id', personIds)
        .in('full_address', addresses)

      existingAddresses?.forEach((address: any) => {
        duplicateKeys.add(`address_${address.person_id}_${address.full_address}`)
      })
    }

    // Batch check employment
    if (relatedData.employment.length > 0) {
      const employers = relatedData.employment.map((e: any) => e.employer_name)
      const { data: existingEmployment } = await supabase
        .from('person_employments')
        .select('person_id, employer_name')
        .in('person_id', personIds)
        .in('employer_name', employers)

      existingEmployment?.forEach((emp: any) => {
        duplicateKeys.add(`employment_${emp.person_id}_${emp.employer_name}`)
      })
    }

    // Batch check vehicles
    if (relatedData.vehicles.length > 0) {
      const vins = relatedData.vehicles.filter((v: any) => v.vin).map((v: any) => v.vin)
      if (vins.length > 0) {
        const { data: existingVehicles } = await supabase
          .from('person_vehicles')
          .select('person_id, vin')
          .in('person_id', personIds)
          .in('vin', vins)

        existingVehicles?.forEach((vehicle: any) => {
          duplicateKeys.add(`vehicle_${vehicle.person_id}_${vehicle.vin}`)
        })
      }
    }

    // Batch check bankruptcies
    if (relatedData.bankruptcies.length > 0) {
      const caseNumbers = relatedData.bankruptcies.filter((b: any) => b.case_number).map((b: any) => b.case_number)
      if (caseNumbers.length > 0) {
        const { data: existingBankruptcies } = await supabase
          .from('person_bankruptcies')
          .select('person_id, case_number')
          .in('person_id', personIds)
          .in('case_number', caseNumbers)

        existingBankruptcies?.forEach((bankruptcy: any) => {
          duplicateKeys.add(`bankruptcy_${bankruptcy.person_id}_${bankruptcy.case_number}`)
        })
      }
    }

  } catch (error) {
    console.error('[BATCH_DUPLICATE_DETECTION] Error:', error)
  }

  return duplicateKeys
}

// Memory-efficient streaming batch processing
async function streamProcessBatch(
  rows: any[],
  batchSize: number = 100,
  supabase: any,
  userId: string,
  portfolioId: string,
  fieldMapping: Record<string, string> | undefined,
  jobId: string
): Promise<{ successful: number, failed: number, errors: any[] }> {
  const results = { successful: 0, failed: 0, errors: [] as any[] }
  
  console.log(`[STREAM_PROCESSING] Starting stream processing for ${rows.length} rows with batch size ${batchSize}`)
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const currentBatchNumber = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(rows.length / batchSize)
    
    console.log(`[STREAM_PROCESSING] Processing batch ${currentBatchNumber}/${totalBatches} (${batch.length} rows)`)
    
    try {
      const batchResults = await processAccountBatch(
        batch, supabase, userId, portfolioId, fieldMapping, jobId
      )
      
      results.successful += batchResults.successful
      results.failed += batchResults.failed
      results.errors.push(...batchResults.errors)
      
      // Update progress after each batch
      const progress = Math.round(((i + batch.length) / rows.length) * 100)
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
        
      console.log(`[STREAM_PROCESSING] Batch ${currentBatchNumber} completed: ${batchResults.successful} successful, ${batchResults.failed} failed`)
      
      // Optional: Add a small delay between batches to prevent overwhelming the database
      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay
      }
      
    } catch (error: any) {
      console.error(`[STREAM_PROCESSING] Error processing batch ${currentBatchNumber}:`, error)
      results.failed += batch.length
      results.errors.push({
        message: `Batch ${currentBatchNumber} failed: ${error.message}`,
        batch_start: i + 1,
        batch_end: Math.min(i + batchSize, rows.length)
      })
    }
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
  
  console.log(`[STREAM_PROCESSING] Stream processing completed: ${results.successful} successful, ${results.failed} failed`)
  return results
}

// Performance monitoring function
async function trackImportPerformance(
  jobId: string,
  startTime: Date,
  totalRows: number,
  successfulRows: number,
  failedRows: number,
  supabase: any
): Promise<void> {
  const endTime = new Date()
  const processingTime = (endTime.getTime() - startTime.getTime()) / 1000 // seconds
  const rowsPerSecond = totalRows / processingTime
  
  console.log(`[PERFORMANCE] Import completed in ${processingTime.toFixed(2)} seconds`)
  console.log(`[PERFORMANCE] Processing rate: ${rowsPerSecond.toFixed(2)} rows/second`)
  console.log(`[PERFORMANCE] Success rate: ${((successfulRows / totalRows) * 100).toFixed(2)}%`)
  
  // Store performance metrics in the database
  try {
    await supabase
      .from('import_performance_metrics')
      .insert({
        job_id: jobId,
        total_rows: totalRows,
        successful_rows: successfulRows,
        failed_rows: failedRows,
        processing_time_seconds: processingTime,
        rows_per_second: rowsPerSecond,
        success_rate: (successfulRows / totalRows) * 100,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      })
  } catch (error) {
    console.error('[PERFORMANCE] Error storing performance metrics:', error)
  }
}