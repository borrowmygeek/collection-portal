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

async function updateImportTemplateWithBankFields() {
  try {
    console.log('Updating import template with bank information fields...')
    
    // First, let's check if there's an existing template for accounts/debtors
    const { data: existingTemplates, error: selectError } = await supabase
      .from('import_templates')
      .select('*')
      .eq('import_type', 'accounts')
      .limit(1)
    
    if (selectError) {
      console.error('Error selecting existing templates:', selectError)
      return
    }
    
    // Define the new bank information fields
    const bankFields = [
      'original_bank_name',
      'original_bank_routing_number', 
      'original_bank_account_number',
      'original_bank_account_type',
      'original_bank_account_holder',
      'original_bank_verified',
      'original_bank_verification_date',
      'original_bank_verification_method'
    ]
    
    if (existingTemplates && existingTemplates.length > 0) {
      // Update existing template
      const template = existingTemplates[0]
      const updatedOptionalColumns = [...(template.optional_columns || []), ...bankFields]
      
      const { data, error } = await supabase
        .from('import_templates')
        .update({
          optional_columns: updatedOptionalColumns,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id)
        .select()
      
      if (error) {
        console.error('Error updating existing template:', error)
      } else {
        console.log('Successfully updated existing template with bank fields:', data)
      }
    } else {
      // Create new template with bank fields
      const newTemplate = {
        name: 'Standard Account Import Template',
        description: 'Template for importing account/debtor data including bank information for payday loans',
        import_type: 'accounts',
        required_columns: [
          'ssn',
          'full_name', 
          'original_balance',
          'current_balance'
        ],
        optional_columns: [
          'account_number',
          'original_account_number',
          'original_creditor',
          'charge_off_date',
          'date_opened',
          'address',
          'city',
          'state',
          'zipcode',
          'email',
          'phone',
          'account_type',
          'interest_rate',
          'late_fees',
          'collection_fees',
          'last_payment_date',
          'last_payment_amount',
          'status',
          'notes',
          // Bank information fields for payday loans
          ...bankFields
        ],
        sample_data: {
          ssn: '123456789',
          full_name: 'John Doe',
          original_balance: 1000.00,
          current_balance: 1000.00,
          account_number: 'ACC123456',
          original_creditor: 'Payday Loan Co',
          original_bank_name: 'Chase Bank',
          original_bank_routing_number: '021000021',
          original_bank_account_number: '1234567890',
          original_bank_account_type: 'checking',
          original_bank_account_holder: 'John Doe'
        },
        validation_rules: {
          ssn: { required: true, pattern: '^[0-9]{9}$' },
          original_balance: { required: true, type: 'number', min: 0 },
          current_balance: { required: true, type: 'number', min: 0 },
          original_bank_routing_number: { pattern: '^[0-9]{9}$' },
          original_bank_account_number: { minLength: 4, maxLength: 17 }
        }
      }
      
      const { data, error } = await supabase
        .from('import_templates')
        .insert(newTemplate)
        .select()
      
      if (error) {
        console.error('Error creating new template:', error)
      } else {
        console.log('Successfully created new template with bank fields:', data)
      }
    }
    
    // Also update the field mapping modal to include bank fields
    console.log('Bank information fields added to import template:')
    bankFields.forEach(field => {
      console.log(`  - ${field}`)
    })
    
  } catch (error) {
    console.error('Error updating import template:', error)
  }
}

updateImportTemplateWithBankFields() 