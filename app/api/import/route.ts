import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { authenticateApiRequest } from '@/lib/auth-utils'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess, logDataModification, AUDIT_ACTIONS } from '@/lib/audit-log'
import { sanitizeString, sanitizeEmail, sanitizePhone, sanitizeAddress, containsSqlInjection } from '@/lib/validation'

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

// Import processing function - moved to top for accessibility
async function processImportJob(jobId: string, filePath: string, fieldMapping: any, portfolioId: string) {
  console.log(`🚀 [PROCESS IMPORT] Function entered with params:`, { jobId, filePath, fieldMapping, portfolioId })
  
  const startTime = Date.now()
  let tempTableName: string | null = null
  
  try {
    console.log(`🚀 Starting import job ${jobId} with temp table approach`)
    
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Update job status to processing
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        progress: 0
      })
      .eq('id', jobId)
    
    // Download and parse the file
    const { data: fileBuffer, error: downloadError } = await supabase.storage
      .from('import-files')
      .download(filePath)
    
    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }
    
    // Debug the file buffer
    console.log(`📊 File buffer info:`, {
      bufferType: typeof fileBuffer,
      bufferSize: fileBuffer?.size || 0,
      bufferIsBlob: fileBuffer instanceof Blob,
      bufferIsArrayBuffer: fileBuffer instanceof ArrayBuffer,
      bufferIsUint8Array: fileBuffer instanceof Uint8Array
    })
    
    if (!fileBuffer || fileBuffer.size === 0) {
      throw new Error('Downloaded file is empty or corrupted')
    }
    
    // Convert Blob to ArrayBuffer for XLSX parsing
    let arrayBuffer: ArrayBuffer
    if (fileBuffer && typeof fileBuffer === 'object' && 'arrayBuffer' in fileBuffer) {
      console.log(`📊 Converting Blob to ArrayBuffer...`)
      arrayBuffer = await (fileBuffer as Blob).arrayBuffer()
      console.log(`📊 ArrayBuffer created:`, {
        byteLength: arrayBuffer.byteLength,
        isArrayBuffer: arrayBuffer instanceof ArrayBuffer
      })
    } else if (fileBuffer && typeof fileBuffer === 'object' && 'byteLength' in fileBuffer) {
      arrayBuffer = fileBuffer as ArrayBuffer
    } else {
      throw new Error(`Unsupported file buffer type: ${typeof fileBuffer}`)
    }
    
    // Parse the file
    console.log(`📊 Starting file parsing...`)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    console.log(`📊 Workbook created, sheet names:`, workbook.worksheets.map(ws => ws.name))
    
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file')
    }
    console.log(`📊 Using sheet: ${worksheet.name}`)
    
    // Get worksheet dimensions
    const dimensions = worksheet.dimensions
    console.log(`📊 Worksheet dimensions:`, dimensions)
    
    if (!dimensions) {
      throw new Error('Worksheet has no dimensions defined')
    }
    
    // Log detailed dimension information
    console.log(`📊 Detailed dimensions analysis:`, {
      top: dimensions.top,
      left: dimensions.left,
      bottom: dimensions.bottom,
      right: dimensions.right,
      totalRows: dimensions.bottom - dimensions.top + 1,
      totalCols: dimensions.right - dimensions.left + 1
    })
    
    // Verify dimensions make sense
    if (dimensions.bottom < dimensions.top) {
      throw new Error(`Invalid dimensions: bottom (${dimensions.bottom}) < top (${dimensions.top})`)
    }
    
    if (dimensions.right < dimensions.left) {
      throw new Error(`Invalid dimensions: right (${dimensions.right}) < left (${dimensions.left})`)
    }
    
    // Build rows by reading each cell
    const rows: any[][] = []
    
    // Read header row (first row)
    const headerRow: any[] = []
    for (let col = dimensions.left; col <= dimensions.right; col++) {
      const cell = worksheet.getCell(dimensions.top, col)
      headerRow.push(cell.value?.toString() || '')
    }
    rows.push(headerRow)
    
    // Read data rows
    let actualDataRows = 0
    for (let row = dimensions.top + 1; row <= dimensions.bottom; row++) {
      const dataRow: any[] = []
      let hasData = false
      
      for (let col = dimensions.left; col <= dimensions.right; col++) {
        const cell = worksheet.getCell(row, col)
        const cellValue = cell.value?.toString() || ''
        dataRow.push(cellValue)
        
        // Check if this row has any non-empty data
        if (cellValue.trim() !== '') {
          hasData = true
        }
      }
      
      // Only count rows that actually have data
      if (hasData) {
        rows.push(dataRow)
        actualDataRows++
      } else {
        console.log(`📊 Skipping empty row ${row} (all cells empty)`)
      }
    }
    
    console.log(`📊 Row analysis:`, {
      totalRowsInFile: rows.length,
      headerRow: 1,
      dataRowsWithContent: actualDataRows,
      emptyRowsSkipped: (dimensions.bottom - dimensions.top) - actualDataRows,
      originalDimensions: dimensions
    })
    
    if (rows.length < 2) {
      console.error(`❌ File parsing failed: rows.length = ${rows.length}`)
      console.error(`❌ First few rows:`, rows)
      console.error(`❌ Dimensions:`, dimensions)
      throw new Error('File must have at least a header row and one data row')
    }
    
    const headers = rows[0] as string[]
    const dataRows = rows.slice(1) as any[]
    
    console.log(`📊 File parsed: ${headers.length} columns, ${dataRows.length} rows`)
    
    // Create temp table
    tempTableName = await createTempImportTable(supabase, jobId, fieldMapping)
    
    // Convert rows to objects with headers
    const rowObjects = dataRows.map((row, index) => {
      const obj: any = { jobId, import_id: jobId }
      headers.forEach((header, colIndex) => {
        if (header && row[colIndex] !== undefined) {
          obj[header] = row[colIndex]
        }
      })
      return obj
    })
    
    // Verify we have valid data before processing
    console.log(`📊 Data validation:`, {
      totalRowObjects: rowObjects.length,
      sampleRowObject: rowObjects[0],
      sampleRowKeys: Object.keys(rowObjects[0] || {}),
      firstFewRows: rowObjects.slice(0, 3).map(row => ({
        keys: Object.keys(row),
        hasJobId: !!row.jobId,
        hasImportId: !!row.import_id
      }))
    })
    
    // Check for potential issues
    if (rowObjects.length === 0) {
      throw new Error('No data rows found after parsing')
    }
    
    if (!rowObjects[0]?.jobId) {
      throw new Error('First row missing jobId - data structure issue')
    }
    
    // Bulk insert to temp table
    console.log(`🚀 [IMPORT] About to call bulkInsertToTempTable with ${rowObjects.length} rows`)
    console.log(`🚀 [IMPORT] Field mapping keys:`, Object.keys(fieldMapping))
    console.log(`🚀 [IMPORT] Sample row object keys:`, Object.keys(rowObjects[0] || {}))
    
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('bulkInsertToTempTable timed out after 60 seconds')), 60000)
      })
      
      const insertPromise = bulkInsertToTempTable(supabase, tempTableName, rowObjects, fieldMapping, jobId)
      
      await Promise.race([insertPromise, timeoutPromise])
      console.log(`✅ [IMPORT] bulkInsertToTempTable completed successfully`)
    } catch (error) {
      console.error(`❌ [IMPORT] bulkInsertToTempTable failed:`, error)
      throw error
    }
    
    console.log(`✅ [IMPORT] bulkInsertToTempTable completed, moving to status update...`)
    
    // File upload and staging is complete - mark as uploaded (not completed)
    console.log(`✅ File uploaded and staged successfully`)
    console.log(`📊 Staging data is available in import_staging_data table for validation and processing`)
    
    // Update job status to uploaded (ready for validation)
    console.log(`🔄 [IMPORT] Updating job status to 'uploaded' for job ${jobId}`)
    console.log(`🔄 [IMPORT] About to execute Supabase update query...`)
    
    try {
      // First verify the job exists
      console.log(`🔄 [IMPORT] Verifying job exists before update...`)
      const { data: existingJob, error: fetchError } = await supabase
        .from('import_jobs')
        .select('id, status, created_at')
        .eq('id', jobId)
        .single()
      
      if (fetchError) {
        console.error(`❌ [IMPORT] Error fetching job for verification:`, fetchError)
        throw fetchError
      }
      
      if (!existingJob) {
        console.error(`❌ [IMPORT] Job ${jobId} not found for update`)
        throw new Error(`Job ${jobId} not found`)
      }
      
      console.log(`✅ [IMPORT] Job verification successful:`, {
        id: existingJob.id,
        currentStatus: existingJob.status,
        createdAt: existingJob.created_at
      })
      
      console.log(`🔄 [IMPORT] Creating update object...`)
      const updateData = { 
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        progress: 0, // No progress yet - waiting for validation
        rows_processed: 0 // No rows processed yet
      }
      console.log(`🔄 [IMPORT] Update data:`, JSON.stringify(updateData, null, 2))
      
      console.log(`🔄 [IMPORT] Executing Supabase update...`)
      console.log(`🔄 [IMPORT] Target table: import_jobs`)
      console.log(`🔄 [IMPORT] Target job ID: ${jobId}`)
      
      const updateResult = await supabase
        .from('import_jobs')
        .update(updateData)
        .eq('id', jobId)
      
      console.log(`🔄 [IMPORT] Update result received:`, {
        data: updateResult.data,
        error: updateResult.error,
        count: updateResult.count,
        status: updateResult.status,
        statusText: updateResult.statusText
      })
      
      if (updateResult.error) {
        console.error(`❌ [IMPORT] Failed to update job status:`, updateResult.error)
        console.error(`❌ [IMPORT] Error details:`, {
          code: updateResult.error.code,
          message: updateResult.error.message,
          details: updateResult.error.details,
          hint: updateResult.error.hint
        })
        throw updateResult.error
      }
      
      console.log(`✅ [IMPORT] Job status updated successfully to 'uploaded'`)
      console.log(`✅ [IMPORT] Update completed, moving to cleanup...`)
    } catch (updateError) {
      console.error(`❌ [IMPORT] Error updating job status:`, updateError)
      console.error(`❌ [IMPORT] Error type:`, typeof updateError)
      console.error(`❌ [IMPORT] Error constructor:`, updateError?.constructor?.name)
      if (updateError instanceof Error) {
        console.error(`❌ [IMPORT] Error stack:`, updateError.stack)
      }
      throw updateError
    }
    
    console.log(`✅ [IMPORT] Status update completed successfully`)
    
    const duration = Date.now() - startTime
    console.log(`✅ [IMPORT] Import job ${jobId} uploaded in ${duration}ms. Ready for validation.`)
    console.log(`✅ [IMPORT] Moving to cleanup phase...`)
    
    // Cleanup: Drop the staging table
    try {
      await cleanupStagingTable(supabase, tempTableName)
    } catch (cleanupError) {
      console.error('Failed to cleanup staging table:', cleanupError)
      // Don't fail the import if cleanup fails
    }
    
    // Email functionality disabled
    // try {
    //   const { data: job } = await supabase
    //     .from('import_jobs')
    //     .select('*')
    //     .eq('id', jobId)
    //     .single()
    //   
    //   if (job) {
    //     await sendImportJobCompletedEmail(
    //       job.user_id, // This should be an email address
    //       job.file_name,
    //       job.import_type,
    //       job.status,
    //       `Processed ${processedCount} rows successfully`
    //     )
    //   }
    // } catch (emailError) {
    //   console.error('Failed to send completion email:', emailError)
    // }
    
  } catch (error) {
    console.error(`❌ [IMPORT] Import job ${jobId} failed:`, error)
    console.error(`❌ [IMPORT] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    console.error(`❌ [IMPORT] Error message:`, error instanceof Error ? error.message : 'No message')
    
    // Cleanup: Drop the staging table even on failure
    if (tempTableName) {
      try {
        console.log(`🧹 [IMPORT] Cleaning up staging table: ${tempTableName}`)
        const cleanupSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await cleanupStagingTable(cleanupSupabase, tempTableName)
        console.log(`✅ [IMPORT] Staging table cleanup completed`)
      } catch (cleanupError) {
        console.error('❌ [IMPORT] Failed to cleanup staging table on error:', cleanupError)
        // Don't fail the error handling if cleanup fails
      }
    }
    
    // Update job status to failed
    try {
      console.log(`🔄 [IMPORT] Updating job status to 'failed' for job ${jobId}`)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const updateResult = await supabase
        .from('import_jobs')
        .update({ 
          status: 'failed', 
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      if (updateResult.error) {
        console.error(`❌ [IMPORT] Failed to update job status to failed:`, updateResult.error)
      } else {
        console.log(`✅ [IMPORT] Job status updated to 'failed' successfully`)
      }
    } catch (updateError) {
      console.error('❌ [IMPORT] Failed to update job status to failed:', updateError)
    }
    
    throw error
  }
}

// Helper functions for temp table processing
async function createTempImportTable(supabase: any, jobId: string, fieldMapping: any) {
  try {
    // Get job details to extract filename
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('file_name, created_at')
      .eq('id', jobId)
      .single()
    
    if (jobError) {
      console.error('[TEMP TABLE] Error getting job details:', jobError)
      throw jobError
    }
    
    // Create table name in format: temp_date_filename
    const date = new Date(job.created_at)
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '') // YYYYMMDD format
    const filename = job.file_name.replace(/\.[^/.]+$/, '') // Remove file extension
    const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars with underscores
    
    const tempTableName = `temp_${dateStr}_${cleanFilename}`
    
    // Get all the target fields from the field mapping
    const targetFields = Object.values(fieldMapping || {})
    const uniqueFields = Array.from(new Set(targetFields as string[]))
    
    console.log(`[TEMP TABLE] Using staging table: ${tempTableName}`)
    console.log(`[TEMP TABLE] Fields to map: ${uniqueFields.join(', ')}`)
    
    // Instead of creating a dynamic table, we'll use a flexible staging approach
    // Store the data in a JSONB column with the field mapping information
    // This allows us to handle any field structure without dynamic table creation
    
    console.log(`[TEMP TABLE] Staging approach: Using JSONB storage for dynamic fields`)
    return tempTableName
    
  } catch (error) {
    console.error('[TEMP TABLE] Failed to setup staging:', error)
    throw new Error(`Failed to setup staging: ${error}`)
  }
}

async function bulkInsertToTempTable(supabase: any, tempTableName: string, rows: any[], fieldMapping: any, jobId: string) {
  try {
    console.log(`🚀 [BULK INSERT] Function started with ${rows.length} rows`)
    console.log(`🚀 [BULK INSERT] tempTableName: ${tempTableName}`)
    console.log(`🚀 [BULK INSERT] jobId: ${jobId}`)
    console.log(`🚀 [BULK INSERT] fieldMapping:`, JSON.stringify(fieldMapping, null, 2))
    
    if (rows.length === 0) {
      console.log(`⚠️ [BULK INSERT] No rows to process, returning early`)
      return
    }
    
    console.log(`📊 [BULK INSERT] Sample row object:`, JSON.stringify(rows[0], null, 2))
    console.log(`📊 [BULK INSERT] Sample row keys:`, Object.keys(rows[0] || {}))
    
    // Prepare the data for bulk insert into the staging table
    console.log(`🔄 [BULK INSERT] Preparing insert data...`)
    const insertData = rows.map((row: any, index) => {
      // Create the mapped data object
      const mappedData: any = {}
      
      // Only log detailed info for first row and every 100th row to reduce log spam
      const shouldLog = index === 0 || (index + 1) % 100 === 0
      
      if (shouldLog) {
        console.log(`🔄 [BULK INSERT] Processing row ${index + 1}:`, {
          rowKeys: Object.keys(row),
          fieldMappingEntries: Object.entries(fieldMapping || {})
        })
      }
      
      Object.entries(fieldMapping || {}).forEach(([targetField, sourceField]) => {
        const sourceValue = row[sourceField as string]
        
        if (shouldLog) {
          console.log(`🔄 [BULK INSERT] Mapping ${sourceField} -> ${targetField}:`, {
            sourceField,
            targetField,
            sourceValue,
            hasValue: sourceValue !== undefined
          })
        }
        
        if (sourceValue !== undefined) {
          mappedData[targetField as string] = sourceValue?.toString() || ''
        }
      })
      
      const insertRow = {
        job_id: jobId,
        table_name: tempTableName,
        row_number: index + 1,
        field_mapping: fieldMapping,
        mapped_data: mappedData,
        raw_data: row
      }
      
      if (index === 0) {
        console.log(`📊 [BULK INSERT] First insert row sample:`, JSON.stringify(insertRow, null, 2))
      }
      
      // Show progress every 500 rows
      if ((index + 1) % 500 === 0) {
        console.log(`📊 [BULK INSERT] Data preparation progress: ${index + 1}/${rows.length} rows processed`)
      }
      
      return insertRow
    })
    
    console.log(`📊 [BULK INSERT] Data preparation completed: ${insertData.length} rows ready for insertion`)
    console.log(`📊 [BULK INSERT] First row mapped_data:`, JSON.stringify(insertData[0]?.mapped_data, null, 2))
    
    // Insert into the staging table - single operation as before
    console.log(`🚀 [BULK INSERT] About to insert into import_staging_data table...`)
    const { data, error } = await supabase
      .from('import_staging_data')
      .insert(insertData)
    
    if (error) {
      console.error('❌ [BULK INSERT] Error inserting data:', error)
      console.error('❌ [BULK INSERT] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw error
    }
    
    console.log(`✅ [BULK INSERT] Successfully inserted ${rows.length} rows into staging table`)
    console.log(`✅ [BULK INSERT] Insert result:`, { 
      data, 
      rowsInserted: data?.length,
      expectedRows: rows.length
    })
    
    return data
  } catch (error) {
    console.error('❌ [BULK INSERT] Failed to insert data:', error)
    console.error('❌ [BULK INSERT] Error type:', typeof error)
    console.error('❌ [BULK INSERT] Error constructor:', error?.constructor?.name)
    console.error('❌ [BULK INSERT] Full error object:', JSON.stringify(error, null, 2))
    throw error
  }
}

async function processFromTempTable(supabase: any, tempTableName: string, portfolioId: string, batchSize: number = 25) {
  try {
    console.log(`[TEMP TABLE] Starting processing from staging table for: ${tempTableName}`)
    
    // Get total count from staging table
    const { count, error: countError } = await supabase
      .from('import_staging_data')
      .select('*', { count: 'exact', head: true })
      .eq('table_name', tempTableName)
    
    if (countError) {
      console.error('[TEMP TABLE] Error getting count:', countError)
      throw countError
    }
    
    console.log(`[TEMP TABLE] Total rows to process: ${count}`)
    
    let processedCount = 0
    let offset = 0
    
    // Limit total processing to avoid timeouts - process max 500 rows
    const maxRowsToProcess = Math.min(count!, 500)
    console.log(`[TEMP TABLE] Limiting processing to first ${maxRowsToProcess} rows to avoid timeout`)
    
    while (offset < maxRowsToProcess) {
      console.log(`[TEMP TABLE] Processing batch: ${offset + 1} to ${Math.min(offset + batchSize, maxRowsToProcess)}`)
      
      // Get batch from staging table
      const { data: batch, error: batchError } = await supabase
        .from('import_staging_data')
        .select('*')
        .eq('table_name', tempTableName)
        .range(offset, offset + batchSize - 1)
        .order('row_number')
      
      if (batchError) {
        console.error('[TEMP TABLE] Error fetching batch:', batchError)
        throw batchError
      }
      
      if (!batch || batch.length === 0) break
      
      // Convert staging data to the format expected by processAccountBatch
      const convertedBatch = batch.map((row: any) => {
        // Use the mapped_data from the staging table
        const mappedData = row.mapped_data || {}
        
        // Add the original raw data as fallback
        const convertedRow = { ...row.raw_data, ...mappedData }
        
        return convertedRow
      })
      
      // Process this batch using the existing function
      await processTempTableBatch(convertedBatch, portfolioId, supabase)
      
      processedCount += batch.length
      offset += batchSize
      
      console.log(`[TEMP TABLE] Processed ${processedCount}/${maxRowsToProcess} rows`)
    }
    
    console.log(`[TEMP TABLE] Completed processing ${processedCount} rows`)
    console.log(`[TEMP TABLE] Staging data for ${tempTableName} will remain for inspection`)
    return processedCount
  } catch (error) {
    console.error('[TEMP TABLE] Failed to process from staging table:', error)
    throw error
  }
}

// Placeholder function for processing temp table batches
async function processTempTableBatch(batch: any[], portfolioId: string, supabase: any) {
  try {
    console.log(`[TEMP BATCH] Processing ${batch.length} rows from temp table`)
    
    // Process each row to create persons and debt accounts
    for (const row of batch) {
      try {
        // Extract basic person data
        const personData = {
          ssn: row.ssn || row.social_security_number || row.social_security,
          first_name: row.first_name || row.firstname || row.fname,
          last_name: row.last_name || row.lastname || row.lname,
          date_of_birth: row.date_of_birth || row.dob || row.birth_date,
          source: 'import'
        }
        
        // Only create person if we have essential data
        if (personData.ssn && personData.first_name && personData.last_name) {
          // Check if person already exists
          const { data: existingPerson } = await supabase
            .from('persons')
            .select('id')
            .eq('ssn', personData.ssn)
            .single()
          
          let personId: string
          
          if (existingPerson) {
            personId = existingPerson.id
            console.log(`[TEMP BATCH] Person already exists: ${personId}`)
          } else {
            // Create new person
            const { data: newPerson, error: personError } = await supabase
              .from('persons')
              .insert(personData)
              .select('id')
              .single()
            
            if (personError) {
              console.error(`[TEMP BATCH] Error creating person:`, personError)
              continue
            }
            
            personId = newPerson.id
            console.log(`[TEMP BATCH] Created new person: ${personId}`)
          }
          
          // Create debt account
          const debtAccountData = {
            person_id: personId,
            portfolio_id: portfolioId,
            account_number: row.account_number || row.acct_num || row.account_num,
            original_balance: parseFloat(row.original_balance || row.balance || row.amount || '0') || 0,
            current_balance: parseFloat(row.current_balance || row.balance || row.amount || '0') || 0,
            account_type: row.account_type || 'unknown',
            status: row.status || 'active',
            source: 'import',
            import_batch_id: (row.import_id || row.jobId)?.toString()
          }
          
          // Only create debt account if we have essential data
          if (debtAccountData.account_number && debtAccountData.original_balance > 0) {
            const { error: debtError } = await supabase
              .from('debt_accounts')
              .insert(debtAccountData)
            
            if (debtError) {
              console.error(`[TEMP BATCH] Error creating debt account:`, debtError)
            } else {
              console.log(`[TEMP BATCH] Created debt account for person: ${personId}`)
            }
          }
        }
      } catch (rowError) {
        console.error(`[TEMP BATCH] Error processing row:`, rowError)
        // Continue with next row
      }
    }
    
    console.log(`[TEMP BATCH] Completed processing ${batch.length} rows`)
    
  } catch (error) {
    console.error('[TEMP BATCH] Error processing batch:', error)
    throw error
  }
}

// Cleanup function - we keep staging data for inspection
async function cleanupStagingTable(supabase: any, tempTableName: string) {
  try {
    console.log(`[CLEANUP] Keeping staging data for table: ${tempTableName}`)
    console.log(`[CLEANUP] Data will remain in import_staging_data table for inspection`)
    
    // Get count of rows for this table
    const { count, error: countError } = await supabase
      .from('import_staging_data')
      .select('*', { count: 'exact', head: true })
      .eq('table_name', tempTableName)
    
    if (countError) {
      console.error('[CLEANUP] Error getting staging data count:', countError)
    } else {
      console.log(`[CLEANUP] Staging table ${tempTableName} contains ${count} rows`)
    }
    
  } catch (error) {
    console.error('[CLEANUP] Failed to check staging data:', error)
    // Don't throw here - cleanup failure shouldn't fail the import
  }
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
  console.log('🔍 [POST HANDLER] Import API: Starting POST request')
  
  // Simple test endpoint first
  const url = new URL(request.url)
  if (url.searchParams.get('test') === 'true') {
    console.log('🔍 [POST HANDLER] Test endpoint called')
    return NextResponse.json({ 
      message: 'POST handler is working',
      timestamp: new Date().toISOString()
    })
  }
  
  try {
    console.log('🔍 [POST HANDLER] Import API: Authenticating request...')
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ Import API: Authentication successful')

    // Check if user has permission to create import jobs
    const allowedRoles = ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user', 'buyer']
    if (!allowedRoles.includes(user.activeRole.roleType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    console.log('✅ Import API: Permission check passed')

    const supabase = createAdminSupabaseClient()
    console.log('✅ Import API: Supabase admin client created')

    console.log('🔍 Import API: Parsing FormData...')
    const formData = await request.formData()
    console.log('✅ Import API: FormData parsed successfully')
    
    const file = formData.get('file') as File
    const importType = formData.get('import_type') as string
    const templateId = formData.get('template_id') as string
    const portfolioId = formData.get('portfolio_id') as string
    
    console.log('🔍 Import API: FormData extracted:', {
      fileName: file?.name,
      fileSize: file?.size,
      importType,
      templateId,
      portfolioId
    })

    if (!file || !importType) {
      return NextResponse.json(
        { error: 'File and import type are required' },
        { status: 400 }
      )
    }

    console.log('✅ Import API: File validation passed')

    // Validate portfolio ID for account imports
    if (importType === 'accounts') {
      if (!portfolioId || portfolioId.trim() === '') {
        return NextResponse.json(
          { error: 'Portfolio ID is required for account imports' },
          { status: 400 }
        )
      }
      
      // Validate that portfolioId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(portfolioId)) {
        return NextResponse.json(
          { error: 'Invalid portfolio ID format' },
          { status: 400 }
        )
      }
    }

    // Test import job creation
    console.log('🔍 Import API: Testing import job creation...')
    try {
      // Create import job
      console.log('🔍 Import API: Creating import job...')
      console.log('🔍 Import API: Job data:', {
        user_id: user.auth_user_id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
        import_type: importType,
        template_id: templateId || null
      })
      
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.auth_user_id,
          file_name: file.name,
          file_size: file.size,
          file_type: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
          import_type: importType,
          template_id: templateId || null,
          portfolio_id: portfolioId || null,
          status: 'pending'
        })
        .select()
        .single()

      if (jobError) {
        console.error('❌ Import API: Error creating import job:', jobError)
        return NextResponse.json(
          { error: `Failed to create import job: ${jobError.message}` },
          { status: 500 }
        )
      }
      
      console.log('✅ Import API: Import job created successfully:', job.id)

      // Get field mapping if provided
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
        userId: user.auth_user_id,
        jobId: job.id
      })
      
      const fileBuffer = await file.arrayBuffer()
      console.log('🔍 Import: File buffer created, size:', fileBuffer.byteLength)
      
      try {
        const { error: uploadError } = await supabase.storage
          .from('import-files')
          .upload(`${user.auth_user_id}/${job.id}/${file.name}`, fileBuffer, {
            contentType: file.type,
            upsert: true
          })
        
        if (uploadError) {
          console.error('❌ Import: Error uploading file to storage:', uploadError)
          await supabase.from('import_jobs').delete().eq('id', job.id)
          return NextResponse.json(
            { error: `Failed to upload file to storage: ${uploadError.message}` },
            { status: 500 }
          )
        }
        
        console.log('✅ Import: File uploaded successfully to storage')
      } catch (uploadException) {
        console.error('❌ Import: Exception during file upload:', uploadException)
        await supabase.from('import_jobs').delete().eq('id', job.id)
        return NextResponse.json(
          { error: `File upload failed: ${uploadException instanceof Error ? uploadException.message : 'Unknown error'}` },
          { status: 500 }
        )
      }

      // Start background processing via separate endpoint
      console.log('🔍 Import: Starting background processing via separate endpoint...')
      
      // Start background processing
      console.log('🔍 Import: Starting background processing...')
      
      // Call processImportJob and handle any immediate errors
      try {
        console.log('🔍 Import: About to call processImportJob with params:', {
          jobId: job.id,
          filePath: `${user.auth_user_id}/${job.id}/${file.name}`,
          fieldMapping: fieldMapping,
          portfolioId: portfolioId
        })
        
        // Start the background processing
        const processingPromise = processImportJob(job.id, `${user.auth_user_id}/${job.id}/${file.name}`, fieldMapping, portfolioId)
        
        console.log('🔍 Import: processImportJob called successfully, got promise:', !!processingPromise)
        
        // Handle completion/failure asynchronously
        processingPromise
          .then(() => {
            console.log('✅ Import: Background processing completed successfully')
          })
          .catch(async (error) => {
            console.error('❌ Import: Background processing failed:', error)
            // Update job status to failed if we can
            try {
              await supabase
                .from('import_jobs')
                .update({ 
                  status: 'failed', 
                  error_message: error instanceof Error ? error.message : 'Unknown error',
                  completed_at: new Date().toISOString()
                })
                .eq('id', job.id)
              console.log('✅ Updated job status to failed')
            } catch (updateError) {
              console.error('❌ Failed to update job status:', updateError)
            }
          })
        
        console.log('✅ Import: Background processing started successfully')
      } catch (startError) {
        console.error('❌ Import: Failed to start background processing:', startError)
        console.error('❌ Import: Start error details:', {
          message: startError instanceof Error ? startError.message : 'Unknown error',
          stack: startError instanceof Error ? startError.stack : 'No stack trace',
          name: startError instanceof Error ? startError.name : 'Unknown error type'
        })
        // Don't fail the entire request, but log the error
      }

      return NextResponse.json({
        success: true,
        job_id: job.id,
        message: 'Import job created and processing started'
      })
      
    } catch (error) {
      console.error('❌ Import API: Error in import job creation:', error)
      return NextResponse.json(
        { error: `Import job creation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

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