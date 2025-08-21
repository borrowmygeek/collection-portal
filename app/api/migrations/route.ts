import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to access migration endpoints
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions to access migration endpoints' },
        { status: 403 }
      )
    }

    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    
    if (body.action === 'apply_migration') {
      // This endpoint is now deprecated - migrations should be applied via Supabase CLI
      return NextResponse.json({
        success: true,
        message: 'Migrations are now managed by Supabase CLI',
        instructions: 'Use "supabase db push" to apply migrations from the supabase/migrations directory'
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 