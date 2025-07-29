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

async function testPersonsTable() {
  try {
    console.log('Testing persons table structure...')
    
    // Try to insert a person with the expected structure
    const testPerson = {
      ssn: '123-45-6789',
      full_name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
      dob: '1990-01-01',
      gender: 'male',
      marital_status: 'single',
      occupation: 'Software Engineer',
      employer: 'Tech Corp',
      annual_income: 75000,
      credit_score: 720,
      do_not_call: false,
      do_not_mail: false,
      do_not_email: false,
      do_not_text: false,
      bankruptcy_filed: false,
      active_military: false,
      deceased_verified: false,
      is_deceased: false,
      homeowner: true,
      ssn_verified: true,
      identity_verified: true
    }
    
    const { data, error } = await supabase
      .from('persons')
      .insert(testPerson)
      .select()
    
    if (error) {
      console.error('Error inserting test person:', error)
      
      // Try to get the table structure by checking what fields are missing
      console.log('\nAnalyzing error to understand table structure...')
      
      // Try inserting with just basic fields
      const basicPerson = {
        ssn: '123-45-6789',
        full_name: 'John Doe'
      }
      
      const { error: basicError } = await supabase
        .from('persons')
        .insert(basicPerson)
      
      if (basicError) {
        console.log('Basic insert error:', basicError.message)
      } else {
        console.log('✅ Basic person insert succeeded')
        // Clean up
        await supabase
          .from('persons')
          .delete()
          .eq('ssn', '123-45-6789')
      }
      
    } else {
      console.log('✅ Successfully inserted test person:', data)
      
      // Clean up the test person
      await supabase
        .from('persons')
        .delete()
        .eq('ssn', '123-45-6789')
    }
    
  } catch (error) {
    console.error('Error testing persons table:', error)
  }
}

testPersonsTable() 