import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [PROCESS] Starting data processing...')
    
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { jobId, chunkSize = 100, startIndex = 0 } = await request.json()
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }
    
    console.log(`🚀 [PROCESS] Processing job: ${jobId}, chunk: ${startIndex + 1}-${startIndex + chunkSize}`)
    
    // Get Supabase client
    const supabase = createAdminSupabaseClient()
    
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
    
    // Get valid rows from staging data
    const validRowNumbers = validationResults.rowDetails
      .filter((row: any) => row.isValid)
      .map((row: any) => row.rowNumber)
    
    console.log(`📊 [PROCESS] Total valid rows: ${validRowNumbers.length}, processing chunk ${startIndex + 1}-${Math.min(startIndex + chunkSize, validRowNumbers.length)}`)
    
    // Process only the current chunk
    const chunkRowNumbers = validRowNumbers.slice(startIndex, startIndex + chunkSize)
    
    if (chunkRowNumbers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No more rows to process',
        completed: true,
        processedCount: 0,
        errors: []
      })
    }
    
    // Fetch staging data for this chunk
    const { data: chunkStagingData, error: chunkError } = await supabase
      .from('import_staging_data')
      .select('*')
      .eq('job_id', jobId)
      .in('row_number', chunkRowNumbers)
      .order('row_number')
    
    if (chunkError) {
      console.error('[PROCESS] Error fetching chunk staging data:', chunkError)
      return NextResponse.json({ error: 'Failed to fetch chunk staging data' }, { status: 500 })
    }
    
    if (!chunkStagingData || chunkStagingData.length === 0) {
      return NextResponse.json({ error: 'No staging data found for chunk' }, { status: 404 })
    }
    
    // Update job status to processing if this is the first chunk
    if (startIndex === 0) {
      await supabase
        .from('import_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          progress: 0,
          processed_rows: 0,
          total_rows: validRowNumbers.length,
          processing_errors: null
        })
        .eq('id', jobId)
    }
    
    // Process the chunk
    let processedCount = 0
    let errors: string[] = []
    
    if (job.import_type === 'accounts') {
      const result = await processAccountsDataChunk(supabase, chunkStagingData, job, clientId)
      processedCount = result.processedCount
      errors = result.errors
    } else {
      return NextResponse.json({ error: `Import type '${job.import_type}' is not supported yet` }, { status: 400 })
    }
    
    // Calculate overall progress
    const totalProcessed = (job.processed_rows || 0) + processedCount
    const progress = Math.round((totalProcessed / validRowNumbers.length) * 100)
    
    // Update job progress
    await supabase
      .from('import_jobs')
      .update({
        processed_rows: totalProcessed,
        progress: progress,
        processing_errors: errors.length > 0 ? errors : null
      })
      .eq('id', jobId)
    
    // Check if this was the last chunk
    const isLastChunk = startIndex + chunkSize >= validRowNumbers.length
    const nextStartIndex = startIndex + chunkSize
    
    if (isLastChunk) {
      // Mark job as completed
      await supabase
        .from('import_jobs')
        .update({
          status: 'completed',
          processing_completed_at: new Date().toISOString(),
          progress: 100
        })
        .eq('id', jobId)
      
      console.log(`✅ [PROCESS] Processing completed for job ${jobId}`)
      
      return NextResponse.json({
        success: true,
        processedCount,
        errors,
        completed: true,
        message: `Processing completed: ${totalProcessed} rows processed${errors.length > 0 ? `, ${errors.length} errors` : ''}`
      })
    } else {
      // Return progress and indicate more chunks to process
      console.log(`📊 [PROCESS] Chunk completed: ${processedCount} rows processed, progress: ${progress}%`)
      
      return NextResponse.json({
        success: true,
        processedCount,
        errors,
        completed: false,
        nextStartIndex,
        progress,
        totalProcessed,
        message: `Chunk processed: ${processedCount} rows, overall progress: ${progress}%`
      })
    }
    
  } catch (error) {
    console.error('[PROCESS] Processing failed:', error)
    
    return NextResponse.json({ 
      error: 'Processing failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function processAccountsDataChunk(supabase: any, stagingData: any[], job: any, clientId: string) {
  let processedCount = 0
  const errors: string[] = []
  
  try {
    console.log(`🚀 [PROCESS] Processing chunk: ${stagingData.length} account rows`)
    
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
          } catch (personError) {
            console.error(`[PROCESS] Error processing person for row ${row.row_number}:`, personError)
            errors.push(`Row ${row.row_number}: Person processing error - ${personError instanceof Error ? personError.message : 'Unknown error'}`)
            processedCount++
            continue
          }
        } else {
          // Handle rows without SSN - create a placeholder person or skip with error
          console.warn(`⚠️ [PROCESS] Row ${row.row_number} has no SSN, skipping person creation`)
          errors.push(`Row ${row.row_number}: No SSN provided - person creation skipped`)
          processedCount++
        }
        
      } catch (rowError) {
        console.error(`[PROCESS] Unexpected error processing row ${row.row_number}:`, rowError)
        errors.push(`Row ${row.row_number}: Unexpected error - ${rowError instanceof Error ? rowError.message : 'Unknown error'}`)
        continue
      }
    }
    
    console.log(`✅ [PROCESS] Chunk completed: ${processedCount} rows processed, ${errors.length} errors`)
    
    return { processedCount, errors }
    
  } catch (error) {
    console.error('[PROCESS] Error processing accounts data chunk:', error)
    errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { processedCount: 0, errors }
  }
} 