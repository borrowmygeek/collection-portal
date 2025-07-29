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

// Our expected database types (from types/database.ts)
const expectedTypes = {
  persons: {
    id: 'string',
    ssn: 'string | null',
    full_name: 'string | null',
    first_name: 'string | null',
    middle_name: 'string | null',
    last_name: 'string | null',
    name_prefix: 'string | null',
    name_suffix: 'string | null',
    maiden_name: 'string | null',
    preferred_name: 'string | null',
    dob: 'string | null',
    gender: "'male' | 'female' | 'other' | 'prefer_not_to_say' | null",
    marital_status: "'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'domestic_partnership' | null",
    occupation: 'string | null',
    employer: 'string | null',
    annual_income: 'number | null',
    credit_score: 'number | null',
    primary_address_id: 'string | null',
    primary_phone_id: 'string | null',
    primary_email_id: 'string | null',
    do_not_call: 'boolean',
    do_not_mail: 'boolean',
    do_not_email: 'boolean',
    do_not_text: 'boolean',
    bankruptcy_filed: 'boolean',
    active_military: 'boolean',
    deceased_verified: 'boolean',
    is_deceased: 'boolean',
    deceased_date: 'string | null',
    homeowner: 'boolean | null',
    ssn_verified: 'boolean',
    identity_verified: 'boolean',
    data_source: 'string | null',
    last_skip_trace_date: 'string | null',
    skip_trace_quality_score: 'number | null',
    created_at: 'string',
    updated_at: 'string'
  },
  master_portfolios: {
    id: 'string',
    name: 'string',
    description: 'string | null',
    client_id: 'string',
    portfolio_type: "'credit_card' | 'medical' | 'personal_loan' | 'auto_loan' | 'mortgage' | 'utility' | 'payday_cash_loan' | 'other'",
    original_balance: 'number',
    account_count: 'number',
    charge_off_date: 'string | null',
    debt_age_months: 'number | null',
    average_balance: 'number | null',
    geographic_focus: 'string[] | null',
    credit_score_range: 'string | null',
    status: "'active' | 'inactive' | 'completed' | 'returned' | 'for_sale'",
    created_at: 'string',
    updated_at: 'string'
  },
  import_templates: {
    id: 'string',
    name: 'string',
    description: 'string | null',
    import_type: "'portfolios' | 'accounts' | 'debtors' | 'clients' | 'agencies'",
    required_columns: 'string[]',
    optional_columns: 'string[]',
    sample_data: 'Json',
    validation_rules: 'Json',
    created_by: 'string | null',
    created_at: 'string',
    updated_at: 'string'
  }
}

async function deepDiveSchema() {
  try {
    console.log('Starting deep dive schema analysis...')
    
    const analysis = {
      summary: {
        tablesChecked: 0,
        tablesMatch: 0,
        tablesMismatch: 0,
        issues: []
      },
      details: {}
    }

    // Check each expected table
    for (const [tableName, expectedFields] of Object.entries(expectedTypes)) {
      console.log(`\n🔍 Checking table: ${tableName}`)
      analysis.summary.tablesChecked++
      
      try {
        // Try to get one row to see the structure
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (error) {
          console.log(`❌ Table ${tableName} error:`, error.message)
          analysis.summary.issues.push({
            table: tableName,
            issue: 'Table not accessible',
            error: error.message
          })
          analysis.summary.tablesMismatch++
          continue
        }
        
        // Get actual fields from the data
        const actualFields = data.length > 0 ? Object.keys(data[0]) : []
        
        console.log(`✅ Table ${tableName} exists`)
        console.log(`   Expected fields: ${Object.keys(expectedFields).length}`)
        console.log(`   Actual fields: ${actualFields.length}`)
        
        // Compare fields
        const expectedFieldNames = Object.keys(expectedFields)
        const missingFields = expectedFieldNames.filter(field => !actualFields.includes(field))
        const extraFields = actualFields.filter(field => !expectedFieldNames.includes(field))
        
        if (missingFields.length === 0 && extraFields.length === 0) {
          console.log(`✅ Table ${tableName} structure matches exactly`)
          analysis.summary.tablesMatch++
        } else {
          console.log(`⚠️  Table ${tableName} has mismatches`)
          if (missingFields.length > 0) {
            console.log(`   Missing fields: ${missingFields.join(', ')}`)
          }
          if (extraFields.length > 0) {
            console.log(`   Extra fields: ${extraFields.join(', ')}`)
          }
          analysis.summary.tablesMismatch++
          analysis.summary.issues.push({
            table: tableName,
            issue: 'Field mismatch',
            missing: missingFields,
            extra: extraFields
          })
        }
        
        analysis.details[tableName] = {
          exists: true,
          expectedFields: expectedFieldNames,
          actualFields: actualFields,
          missingFields: missingFields,
          extraFields: extraFields,
          sampleData: data[0] || null
        }
        
      } catch (err) {
        console.log(`❌ Error checking ${tableName}:`, err.message)
        analysis.summary.issues.push({
          table: tableName,
          issue: 'Error during check',
          error: err.message
        })
        analysis.summary.tablesMismatch++
      }
    }

    // Save analysis
    const analysisPath = path.join(__dirname, '..', 'schema_deep_dive_analysis.json')
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2))
    
    console.log('\n📊 Analysis Summary:')
    console.log(`- Tables checked: ${analysis.summary.tablesChecked}`)
    console.log(`- Tables match: ${analysis.summary.tablesMatch}`)
    console.log(`- Tables mismatch: ${analysis.summary.tablesMismatch}`)
    console.log(`- Issues found: ${analysis.summary.issues.length}`)
    
    if (analysis.summary.issues.length > 0) {
      console.log('\n🚨 Issues found:')
      analysis.summary.issues.forEach(issue => {
        console.log(`  - ${issue.table}: ${issue.issue}`)
      })
    }
    
    console.log(`\n📄 Detailed analysis saved to: ${analysisPath}`)

  } catch (error) {
    console.error('Error in deep dive analysis:', error)
  }
}

deepDiveSchema() 