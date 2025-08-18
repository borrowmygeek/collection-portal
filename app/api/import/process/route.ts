import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  let processingTimeout: NodeJS.Timeout | null = null
  
  try {
    console.log('🚀 [PROCESS] Starting data processing...')
    
    // Set a timeout for the entire processing operation (30 minutes)
    processingTimeout = setTimeout(() => {
      console.error('⏰ [PROCESS] Processing timeout reached (30 minutes)')
    }, 30 * 60 * 1000)
    
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      if (processingTimeout) clearTimeout(processingTimeout)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { jobId } = await request.json()
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }
    
    console.log(`🚀 [PROCESS] Processing job: ${jobId}`)
    
    // Get Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
         // Get the import job details
     const { data: job, error: jobError } = await supabase
       .from('import_jobs')
       .select('*')
       .eq('id', jobId)
       .single()
     
     if (jobError || !job) {
       console.error('[PROCESS] Error fetching job:', jobError)
       return NextResponse.json({ error: 'Import job not found' }, { status: 404 })
     }
     
     // Get portfolio details to get client_id
     let portfolio = null
     let clientId = null
     
     if (job.portfolio_id) {
       const { data: portfolioData, error: portfolioError } = await supabase
         .from('master_portfolios')
         .select('*, master_clients!inner(*)')
         .eq('id', job.portfolio_id)
         .single()
       
       if (portfolioError) {
         console.error('[PROCESS] Error fetching portfolio:', portfolioError)
         return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
       }
       
       portfolio = portfolioData
       clientId = portfolioData.master_clients.id
       console.log(`📊 [PROCESS] Found portfolio: ${portfolioData.name}, client: ${portfolioData.master_clients.name}`)
     } else {
       console.warn('[PROCESS] No portfolio_id found in job, will use default client')
       // Create a default client if none exists
       const { data: existingClient } = await supabase
         .from('master_clients')
         .select('id')
         .limit(1)
         .single()
       
       if (existingClient) {
         clientId = existingClient.id
         console.log(`📊 [PROCESS] Using existing client: ${existingClient.id}`)
       } else {
         // Create a default client
         const { data: newClient, error: clientError } = await supabase
           .from('master_clients')
           .insert({
             name: 'Default Import Client',
             code: 'DEFAULT_IMPORT',
             client_type: 'debt_buyer',
             status: 'active'
           })
           .select('id')
           .single()
         
         if (clientError) {
           console.error('[PROCESS] Error creating default client:', clientError)
           return NextResponse.json({ error: 'Failed to create default client' }, { status: 500 })
         }
         
         clientId = newClient.id
         console.log(`📊 [PROCESS] Created default client: ${newClient.id}`)
       }
     }
    
    // Get validation results to determine which rows to process
    const validationResults = job.validation_results
    if (!validationResults) {
      return NextResponse.json({ error: 'No validation results found. Please run validation first.' }, { status: 400 })
    }
    
    // Debug: Log the validation results received
    console.log(`🔍 [PROCESS] Validation results received:`, {
      totalRows: validationResults.totalRows,
      validRows: validationResults.validRows,
      invalidRows: validationResults.invalidRows,
      errorsCount: validationResults.errors?.length || 0,
      warningsCount: validationResults.warnings?.length || 0,
      rowDetailsCount: validationResults.rowDetails?.length || 0,
      sampleRowDetail: validationResults.rowDetails?.[0],
      hasRowDetails: !!validationResults.rowDetails,
      validationResultsKeys: Object.keys(validationResults)
    })
    
    console.log(`🚀 [PROCESS] Processing ${validationResults.validRows} valid rows...`)
    
    // Get valid rows from staging data with pagination to handle large datasets
    const validRowNumbers = validationResults.rowDetails
      .filter((row: any) => row.isValid)
      .map((row: any) => row.rowNumber)
    
    console.log(`📊 [PROCESS] Total valid rows to process: ${validRowNumbers.length}`)
    
    // Fetch all valid staging data in batches to avoid Supabase's 1000 row limit
    let allValidStagingData: any[] = []
    const batchSize = 1000
    
    for (let offset = 0; offset < validRowNumbers.length; offset += batchSize) {
      const batchRowNumbers = validRowNumbers.slice(offset, offset + batchSize)
      console.log(`📊 [PROCESS] Fetching batch ${Math.floor(offset / batchSize) + 1}: rows ${offset + 1} to ${Math.min(offset + batchSize, validRowNumbers.length)}`)
      
      const { data: batchData, error: batchError } = await supabase
        .from('import_staging_data')
        .select('*')
        .eq('job_id', jobId)
        .in('row_number', batchRowNumbers)
        .order('row_number')
      
      if (batchError) {
        console.error(`[PROCESS] Error fetching batch ${Math.floor(offset / batchSize) + 1}:`, batchError)
        return NextResponse.json({ error: 'Failed to fetch valid staging data' }, { status: 500 })
      }
      
      if (batchData) {
        allValidStagingData = allValidStagingData.concat(batchData)
        console.log(`✅ [PROCESS] Batch ${Math.floor(offset / batchSize) + 1} fetched: ${batchData.length} rows`)
      }
    }
    
    const validStagingData = allValidStagingData
    
    if (!validStagingData || validStagingData.length === 0) {
      return NextResponse.json({ error: 'No valid data found to process' }, { status: 404 })
    }
    
    console.log(`🚀 [PROCESS] Found ${validStagingData.length} valid rows to process`)
    
        // Process the data based on import type
    let processedCount = 0
    let errors: string[] = []
    
         if (job.import_type === 'accounts') {
        const result = await processAccountsData(supabase, validStagingData, job, validRowNumbers.length, clientId)
        processedCount = result.processedCount
        errors = result.errors
      } else {
        return NextResponse.json({ error: `Import type '${job.import_type}' is not supported yet` }, { status: 400 })
      }
    
         // Update job status to completed
     await supabase
       .from('import_jobs')
       .update({
         status: 'completed',
         processing_completed_at: new Date().toISOString(),
         progress: 100,
         processed_rows: processedCount,
         processing_errors: errors.length > 0 ? errors : null
       })
       .eq('id', jobId)
    
    console.log(`✅ [PROCESS] Processing completed for job ${jobId}`)
    console.log(`📊 [PROCESS] Results: ${processedCount} rows processed, ${errors.length} errors`)
    
    // Clear the timeout since processing completed successfully
    if (processingTimeout) clearTimeout(processingTimeout)
    
    return NextResponse.json({
      success: true,
      processedCount,
      errors,
      message: `Processing completed: ${processedCount} rows processed${errors.length > 0 ? `, ${errors.length} errors` : ''}`
    })
    
  } catch (error) {
    console.error('[PROCESS] Processing failed:', error)
    
    // Clear the timeout since processing failed
    if (processingTimeout) clearTimeout(processingTimeout)
    
    return NextResponse.json({ 
      error: 'Processing failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function processAccountsData(supabase: any, stagingData: any[], job: any, totalRows: number, clientId: string) {
  let processedCount = 0
  const errors: string[] = []
  const startTime = new Date()
  
  try {
    console.log('🚀 [PROCESS] Processing accounts data...')
    console.log(`🚀 [PROCESS] Processing ${stagingData.length} account rows`)
    
         // Update job status to show processing has started
     await supabase
       .from('import_jobs')
       .update({
         status: 'processing',
         started_at: new Date().toISOString(),
         progress: 0,
         processed_rows: 0,
         total_rows: totalRows,
         processing_errors: null
       })
       .eq('id', job.id)
    
    for (const row of stagingData) {
      try {
        const mappedData = row.mapped_data
        console.log(`🚀 [PROCESS] Processing row ${row.row_number}: ${mappedData.original_account_number}`)
        
        let personId: string | null = null
        
                                   // Insert into persons table if SSN exists
           if (mappedData.ssn && mappedData.ssn.trim() !== '') {
             try {
               // First try to find existing person by SSN
               const { data: existingPerson, error: findError } = await supabase
                 .from('persons')
                 .select('id')
                 .eq('ssn', mappedData.ssn.trim())
                 .single()
               
               if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
                 console.error(`[PROCESS] Error finding person for row ${row.row_number}:`, findError)
                 errors.push(`Row ${row.row_number}: Error finding person - ${findError.message}`)
                 processedCount++
                 continue
               }
               
               if (existingPerson) {
                 // Person already exists, use existing ID
                 personId = existingPerson.id
                 console.log(`✅ [PROCESS] Found existing person: ${personId}`)
               } else {
                 // Insert new person
                 const { data: personData, error: personError } = await supabase
                   .from('persons')
                   .insert({
                     ssn: mappedData.ssn.trim(),
                     first_name: mappedData.first_name || null,
                     last_name: mappedData.last_name || null,
                     middle_name: mappedData.middle_name || null,
                     dob: mappedData.date_of_birth || null,
                     created_at: new Date().toISOString(),
                     updated_at: new Date().toISOString()
                   })
                   .select('id')
                   .single()
                 
                 if (personError) {
                   console.error(`[PROCESS] Person insert error for row ${row.row_number}:`, personError)
                   errors.push(`Row ${row.row_number}: Failed to insert person data - ${personError.message}`)
                   processedCount++
                   continue
                 }
                 
                 personId = personData.id
                 console.log(`✅ [PROCESS] New person created: ${personId}`)
               }
            
            // Insert address information into person_addresses table if available
            if (mappedData.address_line1 || mappedData.city || mappedData.state) {
              const { error: addressError } = await supabase
                .from('person_addresses')
                .insert({
                  person_id: personId,
                  full_address: [
                    mappedData.address_line1,
                    mappedData.address_line2,
                    mappedData.city,
                    mappedData.state,
                    mappedData.zip_code
                  ].filter(Boolean).join(', '),
                  address_line1: mappedData.address_line1 || null,
                  address_line2: mappedData.address_line2 || null,
                  city: mappedData.city || null,
                  state: mappedData.state || null,
                  zipcode: mappedData.zip_code || null,
                  address_type: 'residential',
                  is_current: true,
                  first_seen: new Date().toISOString().split('T')[0],
                  last_seen: new Date().toISOString().split('T')[0],
                  source: 'import',
                  created_at: new Date().toISOString()
                })
              
              if (addressError) {
                console.error(`[PROCESS] Address insert error for row ${row.row_number}:`, addressError)
                // Don't fail the entire row for address errors, just log them
              } else {
                console.log(`✅ [PROCESS] Address inserted for person ${personId}`)
              }
            }
            
            // Insert phone information into person_phones table if available
            if (mappedData.phone_primary) {
              const { error: phoneError } = await supabase
                .from('person_phones')
                .insert({
                  person_id: personId,
                  number: mappedData.phone_primary,
                  phone_type: 'mobile',
                  is_current: true,
                  first_seen: new Date().toISOString().split('T')[0],
                  last_seen: new Date().toISOString().split('T')[0],
                  source: 'import',
                  created_at: new Date().toISOString()
                })
              
              if (phoneError) {
                console.error(`[PROCESS] Phone insert error for row ${row.row_number}:`, phoneError)
                // Don't fail the entire row for phone errors, just log them
              } else {
                console.log(`✅ [PROCESS] Phone inserted for person ${personId}`)
              }
            }
            
            // Insert email information into person_emails table if available
            if (mappedData.email_primary) {
              const { error: emailError } = await supabase
                .from('person_emails')
                .insert({
                  person_id: personId,
                  email: mappedData.email_primary,
                  is_current: true,
                  first_seen: new Date().toISOString().split('T')[0],
                  last_seen: new Date().toISOString().split('T')[0],
                  source: 'import',
                  created_at: new Date().toISOString()
                })
              
              if (emailError) {
                console.error(`[PROCESS] Email insert error for row ${row.row_number}:`, emailError)
                // Don't fail the entire row for email errors, just log them
              } else {
                console.log(`✅ [PROCESS] Email inserted for person ${personId}`)
              }
            }
            
            // Insert into debt_accounts table
            const { error: accountError } = await supabase
              .from('debt_accounts')
              .insert({
                person_id: personId,
                portfolio_id: job.portfolio_id,
                client_id: clientId,
                account_number: mappedData.account_number || null,
                original_account_number: mappedData.original_account_number,
                current_balance: parseFloat(mappedData.current_balance) || 0,
                original_balance: mappedData.original_balance && mappedData.original_balance.trim() !== '' ? parseFloat(mappedData.original_balance) : 0,
                charge_off_date: mappedData.charge_off_date && mappedData.charge_off_date.trim() !== '' ? mappedData.charge_off_date : null,
                date_opened: mappedData.date_opened && mappedData.date_opened.trim() !== '' ? mappedData.date_opened : null,
                last_payment_date: mappedData.last_payment_date && mappedData.last_payment_date.trim() !== '' ? mappedData.last_payment_date : null,
                last_payment_amount: mappedData.last_payment_amount ? parseFloat(mappedData.last_payment_amount) : null,
                original_creditor: mappedData.creditor_name || null,
                account_type: mappedData.account_type && ['credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'student_loan', 'business_loan', 'other'].includes(mappedData.account_type) ? mappedData.account_type : 'other',
                account_status: mappedData.status && ['active', 'inactive', 'resolved', 'returned', 'bankruptcy', 'deceased', 'settled', 'paid_in_full'].includes(mappedData.status) ? mappedData.status : 'active',
                data_source: 'import',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            
            if (accountError) {
              console.error(`[PROCESS] Account insert error for row ${row.row_number}:`, accountError)
              errors.push(`Row ${row.row_number}: Failed to insert account data - ${accountError.message}`)
              processedCount++
              continue
            }
            
            console.log(`✅ [PROCESS] Account inserted for row ${row.row_number}`)
            processedCount++
          } else {
            // Handle rows without SSN - create a placeholder person or skip with error
            console.warn(`⚠️ [PROCESS] Row ${row.row_number} has no SSN, skipping person creation`)
            errors.push(`Row ${row.row_number}: No SSN provided - person creation skipped`)
            processedCount++
          }
          
          // Update progress every 5 rows or on the last row for more frequent updates
          if (processedCount % 5 === 0 || processedCount === stagingData.length) {
            const progress = Math.round((processedCount / stagingData.length) * 100)
            await supabase
              .from('import_jobs')
              .update({
                progress: progress,
                processed_rows: processedCount,
                processing_errors: errors.length > 0 ? errors : null
              })
              .eq('id', job.id)
            
            console.log(`📊 [PROCESS] Progress: ${progress}% (${processedCount}/${stagingData.length} rows)`)
          }
        
      } catch (rowError) {
        console.error(`[PROCESS] Unexpected error processing row ${row.row_number}:`, rowError)
        errors.push(`Row ${row.row_number}: Unexpected error - ${rowError instanceof Error ? rowError.message : 'Unknown error'}`)
        continue
      }
    }
    
    const endTime = new Date()
    const processingTimeSeconds = (endTime.getTime() - startTime.getTime()) / 1000
    const rowsPerSecond = processingTimeSeconds > 0 ? processedCount / processingTimeSeconds : 0
    const successRate = stagingData.length > 0 ? (processedCount / stagingData.length) * 100 : 0
    
    console.log(`✅ [PROCESS] Processing completed: ${processedCount} rows processed, ${errors.length} errors`)
    console.log(`📊 [PROCESS] Performance: ${processingTimeSeconds.toFixed(2)}s, ${rowsPerSecond.toFixed(2)} rows/s, ${successRate.toFixed(1)}% success rate`)
    
    // Insert performance metrics
    try {
      const { error: metricsError } = await supabase
        .from('import_performance_metrics')
        .insert({
          job_id: job.id,
          total_rows: stagingData.length,
          successful_rows: processedCount,
          failed_rows: errors.length,
          processing_time_seconds: processingTimeSeconds,
          rows_per_second: rowsPerSecond,
          success_rate: successRate,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        })
      
      if (metricsError) {
        console.error('[PROCESS] Error inserting performance metrics:', metricsError)
      } else {
        console.log('✅ [PROCESS] Performance metrics recorded')
      }
    } catch (metricsError) {
      console.error('[PROCESS] Error recording performance metrics:', metricsError)
    }
    
    return { processedCount, errors }
    
  } catch (error) {
    console.error('[PROCESS] Error processing accounts data:', error)
    errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { processedCount: 0, errors }
  }
} 