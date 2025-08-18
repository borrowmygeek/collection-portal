import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('🔍 [SCHEMA DEBUG] Checking import_jobs table schema...')

    // Get a sample row to see columns
    const { data: sampleRow, error: sampleError } = await supabase
      .from('import_jobs')
      .select('*')
      .limit(1)

    if (sampleError) {
      console.error('❌ [SCHEMA DEBUG] Error getting sample row:', sampleError)
      return NextResponse.json({ error: 'Failed to get sample row', details: sampleError }, { status: 500 })
    }

    let columns: string[] = []
    let sampleData: any = null

    if (sampleRow && sampleRow.length > 0) {
      columns = Object.keys(sampleRow[0])
      sampleData = sampleRow[0]
      console.log('✅ [SCHEMA DEBUG] Sample row columns:', columns)
    } else {
      console.log('⚠️ [SCHEMA DEBUG] No rows found in import_jobs table')
    }

    // Check if specific columns exist
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'import_jobs' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      })

    if (columnError) {
      console.error('❌ [SCHEMA DEBUG] Error getting column info:', columnError)
      return NextResponse.json({ error: 'Failed to get column info', details: columnError }, { status: 500 })
    }

    // Check RLS policies
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT policyname, permissive, roles, cmd, qual, with_check
          FROM pg_policies 
          WHERE tablename = 'import_jobs';
        `
      })

    if (policiesError) {
      console.error('❌ [SCHEMA DEBUG] Error getting RLS policies:', policiesError)
      return NextResponse.json({ error: 'Failed to get RLS policies', details: policiesError }, { status: 500 })
    }

    const result = {
      columns: columns,
      sampleData: sampleData,
      columnInfo: columnInfo,
      policies: policies,
      hasUploadedAt: columns.includes('uploaded_at'),
      hasValidationResults: columns.includes('validation_results'),
      hasValidationCompletedAt: columns.includes('validation_completed_at'),
      hasStartedAt: columns.includes('started_at'),
      hasProcessingCompletedAt: columns.includes('processing_completed_at'),
      hasProcessingErrors: columns.includes('processing_errors'),
      hasRowsProcessed: columns.includes('rows_processed')
    }

    console.log('✅ [SCHEMA DEBUG] Schema check completed:', result)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [SCHEMA DEBUG] Unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error', details: error }, { status: 500 })
  }
} 