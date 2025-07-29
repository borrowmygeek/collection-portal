const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkImportTemplates() {
  try {
    console.log('Checking import_templates table structure...')
    
    // Try to insert a template with the structure we expect
    const testTemplate = {
      name: 'Test Template',
      description: 'Test description',
      import_type: 'accounts',
      required_columns: ['ssn', 'current_balance'],
      optional_columns: ['account_number', 'original_loan_date'],
      sample_data: [],
      validation_rules: []
    }
    
    const { data, error } = await supabase
      .from('import_templates')
      .insert(testTemplate)
      .select()
    
    if (error) {
      console.error('Error inserting test template:', error)
      
      // Try to get existing templates to see the structure
      const { data: existingTemplates, error: selectError } = await supabase
        .from('import_templates')
        .select('*')
        .limit(1)
      
      if (selectError) {
        console.error('Error selecting templates:', selectError)
      } else {
        console.log('Existing template structure:', JSON.stringify(existingTemplates[0], null, 2))
      }
    } else {
      console.log('Successfully inserted test template:', data)
      
      // Clean up the test template
      await supabase
        .from('import_templates')
        .delete()
        .eq('name', 'Test Template')
    }
    
  } catch (error) {
    console.error('Error checking import_templates:', error)
  }
}

checkImportTemplates() 