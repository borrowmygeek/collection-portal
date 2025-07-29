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

async function checkPortfolioTypes() {
  try {
    console.log('Checking master_portfolios table structure...')
    
    // Try to insert a portfolio with payday_cash_loan type
    const testPortfolio = {
      name: 'Test Payday Portfolio',
      description: 'Test payday loan portfolio',
      client_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
      portfolio_type: 'payday_cash_loan',
      original_balance: 100000,
      account_count: 100,
      status: 'active'
    }
    
    const { data, error } = await supabase
      .from('master_portfolios')
      .insert(testPortfolio)
      .select()
    
    if (error) {
      console.error('Error inserting test portfolio:', error)
      
      // Check what portfolio types are currently allowed
      console.log('Checking current portfolio types...')
      
      // Try different portfolio types to see what's allowed
      const portfolioTypes = ['credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'payday_cash_loan', 'payday_loan', 'other']
      
      for (const type of portfolioTypes) {
        const testData = {
          name: `Test ${type} Portfolio`,
          description: `Test ${type} portfolio`,
          client_id: '00000000-0000-0000-0000-000000000000',
          portfolio_type: type,
          original_balance: 100000,
          account_count: 100,
          status: 'active'
        }
        
        const { error: typeError } = await supabase
          .from('master_portfolios')
          .insert(testData)
        
        if (typeError) {
          console.log(`❌ ${type}: ${typeError.message}`)
        } else {
          console.log(`✅ ${type}: Allowed`)
          // Clean up
          await supabase
            .from('master_portfolios')
            .delete()
            .eq('name', `Test ${type} Portfolio`)
        }
      }
    } else {
      console.log('Successfully inserted test portfolio:', data)
      
      // Clean up the test portfolio
      await supabase
        .from('master_portfolios')
        .delete()
        .eq('name', 'Test Payday Portfolio')
    }
    
  } catch (error) {
    console.error('Error checking portfolio types:', error)
  }
}

checkPortfolioTypes() 