const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createAuditLogsTable() {
  try {
    console.log('Creating audit_logs table...')

    // Check if table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'audit_logs')
      .eq('table_schema', 'public')
      .single()

    if (existingTable) {
      console.log('✅ audit_logs table already exists')
      return
    }

    // Create the table using raw SQL
    const createTableSQL = `
      CREATE TABLE audit_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(255),
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        session_id VARCHAR(255),
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // Since we can't use exec_sql, let's create a simple version without RLS for now
    // We'll add RLS policies later through the Supabase dashboard or migration
    
    console.log('Note: Table creation requires database admin access.')
    console.log('Please create the audit_logs table manually in your Supabase dashboard:')
    console.log('')
    console.log('SQL to run in Supabase SQL Editor:')
    console.log('---')
    console.log(createTableSQL)
    console.log('---')
    console.log('')
    console.log('After creating the table, you can add indexes and RLS policies as needed.')

  } catch (error) {
    console.error('Error:', error)
  }
}

createAuditLogsTable() 