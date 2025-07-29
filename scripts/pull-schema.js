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

async function pullSchema() {
  try {
    console.log('Pulling database schema...')
    
    // Get all tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name')

    if (tablesError) {
      console.error('Error fetching tables:', tablesError)
      return
    }

    console.log(`Found ${tables.length} tables`)

    const schema = {
      tables: {},
      enums: {},
      functions: {},
      views: {}
    }

    // Get table schemas
    for (const table of tables) {
      if (table.table_type === 'BASE TABLE') {
        console.log(`Processing table: ${table.table_name}`)
        
        // Get columns
        const { data: columns, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default, character_maximum_length')
          .eq('table_schema', 'public')
          .eq('table_name', table.table_name)
          .order('ordinal_position')

        if (columnsError) {
          console.error(`Error fetching columns for ${table.table_name}:`, columnsError)
          continue
        }

        // Get constraints
        const { data: constraints, error: constraintsError } = await supabase
          .from('information_schema.table_constraints')
          .select('constraint_name, constraint_type')
          .eq('table_schema', 'public')
          .eq('table_name', table.table_name)

        if (constraintsError) {
          console.error(`Error fetching constraints for ${table.table_name}:`, constraintsError)
        }

        // Get indexes
        const { data: indexes, error: indexesError } = await supabase
          .from('pg_indexes')
          .select('indexname, indexdef')
          .eq('schemaname', 'public')
          .eq('tablename', table.table_name)

        if (indexesError) {
          console.error(`Error fetching indexes for ${table.table_name}:`, indexesError)
        }

        schema.tables[table.table_name] = {
          columns: columns,
          constraints: constraints || [],
          indexes: indexes || []
        }
      } else if (table.table_type === 'VIEW') {
        schema.views[table.table_name] = {}
      }
    }

    // Get enums
    const { data: enums, error: enumsError } = await supabase
      .from('pg_enum')
      .select('enumtypid::regtype as enum_name, enumlabel')
      .eq('enumtypid::regnamespace::name', 'public')

    if (!enumsError && enums) {
      enums.forEach(enumItem => {
        const enumName = enumItem.enum_name.replace('public.', '')
        if (!schema.enums[enumName]) {
          schema.enums[enumName] = []
        }
        schema.enums[enumName].push(enumItem.enumlabel)
      })
    }

    // Save schema to file
    const schemaPath = path.join(__dirname, '..', 'current_schema.json')
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2))
    
    console.log(`Schema saved to: ${schemaPath}`)
    console.log('Schema summary:')
    console.log(`- Tables: ${Object.keys(schema.tables).length}`)
    console.log(`- Views: ${Object.keys(schema.views).length}`)
    console.log(`- Enums: ${Object.keys(schema.enums).length}`)
    
    // Also generate a SQL schema file
    const sqlSchema = generateSQLSchema(schema)
    const sqlPath = path.join(__dirname, '..', 'current_schema.sql')
    fs.writeFileSync(sqlPath, sqlSchema)
    console.log(`SQL schema saved to: ${sqlPath}`)

  } catch (error) {
    console.error('Error pulling schema:', error)
  }
}

function generateSQLSchema(schema) {
  let sql = '-- Current Database Schema\n'
  sql += '-- Generated from Supabase\n\n'

  // Generate table definitions
  for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
    sql += `-- Table: ${tableName}\n`
    sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`
    
    const columns = tableInfo.columns.map(col => {
      let def = `  ${col.column_name} ${col.data_type}`
      if (col.character_maximum_length) {
        def += `(${col.character_maximum_length})`
      }
      if (col.is_nullable === 'NO') {
        def += ' NOT NULL'
      }
      if (col.column_default) {
        def += ` DEFAULT ${col.column_default}`
      }
      return def
    })
    
    sql += columns.join(',\n') + '\n'
    sql += ');\n\n'
  }

  return sql
}

pullSchema() 