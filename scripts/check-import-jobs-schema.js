const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔍 Checking import_jobs table schema...');
    
    // Get a sample row to see columns
    const { data: sampleRow, error: sampleError } = await supabase
      .from('import_jobs')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error getting sample row:', sampleError);
      return;
    }
    
    if (sampleRow && sampleRow.length > 0) {
      console.log('✅ Sample row columns:', Object.keys(sampleRow[0]));
      console.log('📊 Sample row data:', JSON.stringify(sampleRow[0], null, 2));
    } else {
      console.log('⚠️ No rows found in import_jobs table');
    }
    
    // Check if specific columns exist
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'import_jobs' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (columnsError) {
      console.error('❌ Error getting column info:', columnsError);
      return;
    }
    
    console.log('📋 import_jobs table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Check RLS policies
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT policyname, permissive, roles, cmd, qual, with_check
          FROM pg_policies 
          WHERE tablename = 'import_jobs';
        `
      });
    
    if (policiesError) {
      console.error('❌ Error getting RLS policies:', policiesError);
      return;
    }
    
    console.log('🔒 RLS policies for import_jobs:');
    policies.forEach(policy => {
      console.log(`  - ${policy.policyname}: ${policy.cmd} (roles: ${policy.roles})`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSchema(); 