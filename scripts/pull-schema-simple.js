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
    
    // Get all tables using direct SQL
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            tablename as table_name,
            schemaname as schema_name
          FROM pg_tables 
          WHERE schemaname = 'public'
          ORDER BY tablename
        `
      })

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
      console.log(`Processing table: ${table.table_name}`)
      
      // Get columns using direct SQL
      const { data: columns, error: columnsError } = await supabase
        .rpc('exec_sql', {
          sql: `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default,
              character_maximum_length,
              ordinal_position
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '${table.table_name}'
            ORDER BY ordinal_position
          `
        })

      if (columnsError) {
        console.error(`Error fetching columns for ${table.table_name}:`, columnsError)
        continue
      }

      // Get constraints
      const { data: constraints, error: constraintsError } = await supabase
        .rpc('exec_sql', {
          sql: `
            SELECT 
              constraint_name,
              constraint_type
            FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = '${table.table_name}'
          `
        })

      if (constraintsError) {
        console.error(`Error fetching constraints for ${table.table_name}:`, constraintsError)
      }

      // Get indexes
      const { data: indexes, error: indexesError } = await supabase
        .rpc('exec_sql', {
          sql: `
            SELECT 
              indexname,
              indexdef
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = '${table.table_name}'
          `
        })

      if (indexesError) {
        console.error(`Error fetching indexes for ${table.table_name}:`, indexesError)
      }

      schema.tables[table.table_name] = {
        columns: columns || [],
        constraints: constraints || [],
        indexes: indexes || []
      }
    }

    // Get enums
    const { data: enums, error: enumsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            t.typname as enum_name,
            e.enumlabel as enum_value
          FROM pg_type t 
          JOIN pg_enum e ON t.oid = e.enumtypid  
          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public'
          ORDER BY t.typname, e.enumsortorder
        `
      })

    if (!enumsError && enums) {
      enums.forEach(enumItem => {
        if (!schema.enums[enumItem.enum_name]) {
          schema.enums[enumItem.enum_name] = []
        }
        schema.enums[enumItem.enum_name].push(enumItem.enum_value)
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