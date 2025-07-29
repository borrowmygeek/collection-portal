const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyPortfolioTypeMigration() {
  console.log('🔄 Applying portfolio type migration...')
  
  try {
    // Update master_portfolios table
    console.log('📝 Updating master_portfolios table...')
    const { error: masterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE master_portfolios 
        DROP CONSTRAINT IF EXISTS master_portfolios_portfolio_type_check;

        ALTER TABLE master_portfolios 
        ADD CONSTRAINT master_portfolios_portfolio_type_check 
        CHECK (portfolio_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'payday_cash_loan', 'other'));
      `
    })

    if (masterError) {
      console.error('❌ Error updating master_portfolios:', masterError)
      return
    }

    // Update portfolios table
    console.log('📝 Updating portfolios table...')
    const { error: portfolioError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE portfolios 
        DROP CONSTRAINT IF EXISTS portfolios_portfolio_type_check;

        ALTER TABLE portfolios 
        ADD CONSTRAINT portfolios_portfolio_type_check 
        CHECK (portfolio_type IN ('credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'payday_cash_loan', 'other'));
      `
    })

    if (portfolioError) {
      console.error('❌ Error updating portfolios:', portfolioError)
      return
    }

    console.log('✅ Portfolio type migration applied successfully!')
    console.log('🎉 "Payday/Cash Loan" portfolio type is now available')

  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

applyPortfolioTypeMigration() 