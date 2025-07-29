const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getSchema() {
  try {
    console.log('Getting database schema...')
    
    // Get all tables by trying to select from them
    const tableNames = [
      'persons', 'debtors', 'person_addresses', 'phone_numbers', 'emails', 'payments',
      'master_agencies', 'master_clients', 'master_portfolios', 'platform_users',
      'import_templates', 'import_jobs'
    ]
    
    const schema = {
      tables: {},
      errors: []
    }

    for (const tableName of tableNames) {
      try {
        console.log(`Checking table: ${tableName}`)
        
        // Try to get one row to see the structure
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (error) {
          console.log(`Table ${tableName} error:`, error.message)
          schema.errors.push({ table: tableName, error: error.message })
          continue
        }
        
        // Get table structure by trying to insert a dummy row (which will fail but show us the structure)
        const { error: insertError } = await supabase
          .from(tableName)
          .insert({ __dummy__: 'test' })
        
        if (insertError) {
          // Parse the error to understand the table structure
          const errorMsg = insertError.message
          console.log(`Table ${tableName} structure error:`, errorMsg)
          
          // Extract column information from error message
          const columns = []
          if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
            // This gives us info about what columns exist
            schema.tables[tableName] = {
              exists: true,
              error: errorMsg,
              columns: 'See error message for details'
            }
          } else {
            schema.tables[tableName] = {
              exists: true,
              error: errorMsg
            }
          }
        }
        
      } catch (err) {
        console.log(`Error checking ${tableName}:`, err.message)
        schema.errors.push({ table: tableName, error: err.message })
      }
    }

    // Save schema to file
    const schemaPath = path.join(__dirname, '..', 'current_schema_analysis.json')
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2))
    
    console.log(`Schema analysis saved to: ${schemaPath}`)
    console.log('Schema summary:')
    console.log(`- Tables checked: ${tableNames.length}`)
    console.log(`- Tables found: ${Object.keys(schema.tables).length}`)
    console.log(`- Errors: ${schema.errors.length}`)

  } catch (error) {
    console.error('Error getting schema:', error)
  }
}

getSchema() 