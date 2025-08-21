import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [VALIDATION] Starting import validation...')
    
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { jobId } = await request.json()
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }
    
    console.log(`🔍 [VALIDATION] Validating job: ${jobId}`)
    
    // Get Supabase client
    const supabase = createAdminSupabaseClient()
    
    // Update job status to show validation is starting
    await supabase
      .from('import_jobs')
      .update({
        status: 'validating',
        progress: 10,
        started_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    // Get the import job details
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (jobError || !job) {
      console.error('[VALIDATION] Error fetching job:', jobError)
      return NextResponse.json({ error: 'Import job not found' }, { status: 404 })
    }
    
    // Update progress - fetching staging data
    await supabase
      .from('import_jobs')
      .update({ progress: 20 })
      .eq('id', jobId)
    
    // Get staging data for this job (handle pagination to get ALL rows)
    let allStagingData: any[] = []
    let offset = 0
    const batchSize = 1000
    
    while (true) {
      const { data: batchData, error: batchError } = await supabase
        .from('import_staging_data')
        .select('*')
        .eq('job_id', jobId)
        .order('row_number')
        .range(offset, offset + batchSize - 1)
      
      if (batchError) {
        console.error('[VALIDATION] Error fetching batch:', batchError)
        return NextResponse.json({ error: 'Failed to fetch staging data' }, { status: 500 })
      }
      
      if (!batchData || batchData.length === 0) {
        break
      }
      
      allStagingData = allStagingData.concat(batchData)
      console.log(`📥 [VALIDATION] Fetched batch ${Math.floor(offset / batchSize) + 1}: ${batchData.length} rows`)
      
      // Update progress based on data fetching
      const fetchProgress = Math.min(40, 20 + (allStagingData.length / (job.total_rows || allStagingData.length)) * 20)
      await supabase
        .from('import_jobs')
        .update({ progress: Math.round(fetchProgress) })
        .eq('id', jobId)
      
      if (batchData.length < batchSize) {
        break // Last batch
      }
      
      offset += batchSize
    }
    
    const stagingData = allStagingData
    
    if (!stagingData || stagingData.length === 0) {
      return NextResponse.json({ error: 'No staging data found' }, { status: 404 })
    }
    
    console.log(`🔍 [VALIDATION] Validating ${stagingData.length} rows...`)
    
    // Update progress - validation starting
    await supabase
      .from('import_jobs')
      .update({ progress: 50 })
      .eq('id', jobId)
    
    // Run validation on the data
    const validationResults = await validateImportData(stagingData, job.import_type)
    
    // Update progress - validation completed
    await supabase
      .from('import_jobs')
      .update({ progress: 90 })
      .eq('id', jobId)
    
    // Update job with validation results and status
    await supabase
      .from('import_jobs')
      .update({
        status: 'validated',
        validation_results: validationResults,
        validation_completed_at: new Date().toISOString(),
        progress: 100 // Validation complete
      })
      .eq('id', jobId)
    
    console.log(`✅ [VALIDATION] Validation completed for job ${jobId}`)
    console.log(`📊 [VALIDATION] Results: ${validationResults.validRows} valid, ${validationResults.invalidRows} invalid`)
    
    // Debug: Log the validation results structure
    console.log(`🔍 [VALIDATION] Validation results structure:`, {
      totalRows: validationResults.totalRows,
      validRows: validationResults.validRows,
      invalidRows: validationResults.invalidRows,
      errorsCount: validationResults.errors.length,
      warningsCount: validationResults.warnings.length,
      rowDetailsCount: validationResults.rowDetails.length,
      sampleRowDetail: validationResults.rowDetails[0],
      sampleValidRow: validationResults.rowDetails.find((row: any) => row.isValid),
      sampleInvalidRow: validationResults.rowDetails.find((row: any) => !row.isValid)
    })
    
    return NextResponse.json({
      success: true,
      validationResults,
      message: `Validation completed: ${validationResults.validRows} valid rows, ${validationResults.invalidRows} invalid rows`
    })
    
  } catch (error) {
    console.error('[VALIDATION] Validation failed:', error)
    
    // Update job status to failed if we have a jobId
    try {
      const { jobId } = await request.json()
      if (jobId) {
        const supabase = createAdminSupabaseClient()
        
        await supabase
          .from('import_jobs')
          .update({
            status: 'failed',
            progress: 0,
            errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
          })
          .eq('id', jobId)
      }
    } catch (updateError) {
      console.error('[VALIDATION] Failed to update job status:', updateError)
    }
    
    return NextResponse.json({ 
      error: 'Validation failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function validateImportData(stagingData: any[], importType: string) {
  const validationResults = {
    totalRows: stagingData.length,
    validRows: 0,
    invalidRows: 0,
    errors: [] as any[],
    warnings: [] as any[],
    rowDetails: [] as any[]
  }
  
  console.log(`🔍 [VALIDATION] Starting validation for ${importType} import...`)
  
  for (const row of stagingData) {
    const rowValidation = validateRow(row, importType)
    
    if (rowValidation.isValid) {
      validationResults.validRows++
    } else {
      validationResults.invalidRows++
      validationResults.errors.push(...rowValidation.errors)
    }
    
    if (rowValidation.warnings.length > 0) {
      validationResults.warnings.push(...rowValidation.warnings)
    }
    
    validationResults.rowDetails.push({
      rowNumber: row.row_number,
      isValid: rowValidation.isValid,
      errors: rowValidation.errors,
      warnings: rowValidation.warnings
    })
  }
  
  return validationResults
}

function validateRow(row: any, importType: string) {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Get the mapped data (this is what will be processed)
  const mappedData = row.mapped_data || {}
  
  // Common validation rules for all import types
  if (importType === 'accounts') {
    // REQUIRED fields for account imports (only these two are truly required)
    if (!mappedData.original_account_number || mappedData.original_account_number.trim() === '') {
      errors.push('Original account number is required')
    }
    
    if (!mappedData.current_balance || mappedData.current_balance === '') {
      errors.push('Current balance is required')
    } else if (isNaN(parseFloat(mappedData.current_balance))) {
      errors.push('Current balance should be a number')
    }
    
    // RECOMMENDED fields (can be null but should be validated if present)
    if (mappedData.ssn && mappedData.ssn.trim() !== '') {
      if (!isValidSSN(mappedData.ssn)) {
        warnings.push('SSN format may be invalid')
      }
    }
    
    if (mappedData.charge_off_date && mappedData.charge_off_date.trim() !== '') {
      if (!isValidDate(mappedData.charge_off_date)) {
        warnings.push('Charge off date format may be invalid')
      }
    }
    
    if (mappedData.date_opened && mappedData.date_opened.trim() !== '') {
      if (!isValidDate(mappedData.date_opened)) {
        warnings.push('Date opened format may be invalid')
      }
    }
    
    // Optional fields with warnings (not required)
    if (!mappedData.account_number || mappedData.account_number.trim() === '') {
      warnings.push('Account number is missing (optional)')
    }
    
    // Phone number validation (optional)
    if (mappedData.phone_primary && !isValidPhone(mappedData.phone_primary)) {
      warnings.push('Primary phone number format may be invalid')
    }
    
    // Email validation (optional)
    if (mappedData.email_primary && !isValidEmail(mappedData.email_primary)) {
      warnings.push('Primary email format may be invalid')
    }
  }
  
  // Add more import type validations here as needed
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// Validation helper functions
function isValidSSN(ssn: string): boolean {
  if (!ssn) return false
  const cleanSSN = ssn.replace(/[^0-9]/g, '')
  return cleanSSN.length === 9
}

function isValidPhone(phone: string): boolean {
  if (!phone) return false
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  return cleanPhone.length >= 10 && cleanPhone.length <= 15
}

function isValidEmail(email: string): boolean {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidDate(date: string): boolean {
  if (!date) return false
  const parsedDate = new Date(date)
  return !isNaN(parsedDate.getTime())
} 