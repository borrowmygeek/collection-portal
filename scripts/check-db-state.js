const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

async function checkDatabaseState() {
  console.log('🔍 Checking database state...')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Check if the fast profile function exists
    console.log('\n1. Checking if get_user_profile_fast function exists...')
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .eq('routine_name', 'get_user_profile_fast')

    if (funcError) {
      console.error('❌ Error checking functions:', funcError)
    } else {
      console.log('✅ Functions found:', functions?.length || 0)
      if (functions && functions.length > 0) {
        console.log('   - get_user_profile_fast exists')
      } else {
        console.log('   ❌ get_user_profile_fast does NOT exist')
      }
    }

    // Check RLS policies
    console.log('\n2. Checking RLS policies...')
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('tablename, policyname, permissive, roles, cmd, qual')
      .eq('schemaname', 'public')
      .in('tablename', ['platform_users', 'user_roles'])

    if (policyError) {
      console.error('❌ Error checking policies:', policyError)
    } else {
      console.log('✅ RLS policies found:', policies?.length || 0)
      policies?.forEach(policy => {
        console.log(`   - ${policy.tablename}.${policyname} (${policy.cmd})`)
      })
    }

    // Check table structure
    console.log('\n3. Checking table structure...')
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('table_name, column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .in('table_name', ['platform_users', 'user_roles'])
      .order('table_name', { ascending: true })

    if (colError) {
      console.error('❌ Error checking columns:', colError)
    } else {
      console.log('✅ Table columns found:', columns?.length || 0)
      const tableGroups = {}
      columns?.forEach(col => {
        if (!tableGroups[col.table_name]) tableGroups[col.table_name] = []
        tableGroups[col.table_name].push(col)
      })
      
      Object.entries(tableGroups).forEach(([table, cols]) => {
        console.log(`\n   Table: ${table}`)
        cols.forEach(col => {
          console.log(`     - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`)
        })
      })
    }

    // Check if RLS is enabled
    console.log('\n4. Checking RLS status...')
    const { data: rlsStatus, error: rlsError } = await supabase
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('schemaname', 'public')
      .in('tablename', ['platform_users', 'user_roles'])

    if (rlsError) {
      console.error('❌ Error checking RLS status:', rlsError)
    } else {
      console.log('✅ RLS status:')
      rlsStatus?.forEach(table => {
        console.log(`   - ${table.tablename}: RLS ${table.rowsecurity ? 'ENABLED' : 'DISABLED'}`)
      })
    }

    // Check actual data
    console.log('\n5. Checking actual data...')
    const { data: users, error: usersError } = await supabase
      .from('platform_users')
      .select('id, email, auth_user_id, status')
      .limit(5)

    if (usersError) {
      console.error('❌ Error checking users:', usersError)
    } else {
      console.log('✅ Users found:', users?.length || 0)
      users?.forEach(user => {
        console.log(`   - ${user.email} (${user.status})`)
      })
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('id, user_id, role_type, is_active, is_primary, permissions')
      .limit(5)

    if (rolesError) {
      console.error('❌ Error checking roles:', rolesError)
    } else {
      console.log('✅ Roles found:', roles?.length || 0)
      roles?.forEach(role => {
        console.log(`   - ${role.role_type} (${role.is_active ? 'active' : 'inactive'}, ${role.is_primary ? 'primary' : 'secondary'})`)
        console.log(`     Permissions: ${JSON.stringify(role.permissions)}`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkDatabaseState()
