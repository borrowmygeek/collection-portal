import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPasswordResetEmail } from '@/lib/email'
import { rateLimitByUser } from '@/lib/rate-limit'
import { logDataAccess } from '@/lib/audit-log'

// Force dynamic runtime for this API route
export const dynamic = 'force-dynamic'

// Create admin client for data operations
const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('platform_users')
      .select('id, email, full_name')
      .eq('email', email)
      .single()

    if (userError || !user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json(
        { message: 'If an account with that email exists, a password reset link has been sent.' },
        { status: 200 }
      )
    }

    // Rate limiting - 3 requests per hour per email
    const rateLimitResult = await rateLimitByUser(email, 3, 3600000) // 1 hour
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { 
          status: 429,
          headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '3600' }
        }
      )
    }

    // Generate a secure reset token
    const resetToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Store the reset token in the database
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt.toISOString(),
        email: email
      })

    if (tokenError) {
      console.error('Error storing reset token:', tokenError)
      return NextResponse.json(
        { error: 'Failed to process password reset request' },
        { status: 500 }
      )
    }

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetToken)
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError)
      // Clean up the token if email fails
      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('token', resetToken)
      
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      )
    }

    // Log the password reset request
    await logDataAccess(
      user.id,
      'PASSWORD_RESET_REQUEST',
      'platform_users',
      undefined,
      { email, resetTokenGenerated: true },
      request
    )

    return NextResponse.json(
      { message: 'If an account with that email exists, a password reset link has been sent.' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabaseClient()

    // Find and validate the reset token
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (tokenError || !resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('platform_users')
      .select('id, email, auth_user_id')
      .eq('id', resetToken.user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update the user's password in Supabase Auth
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      user.auth_user_id,
      { password: newPassword }
    )

    if (passwordError) {
      console.error('Error updating password:', passwordError)
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Mark the token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('token', token)

    // Log the password reset
    await logDataAccess(
      user.id,
      'PASSWORD_RESET_COMPLETED',
      'platform_users',
      undefined,
      { email: user.email, tokenUsed: true },
      request
    )

    return NextResponse.json(
      { message: 'Password has been successfully reset' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Password reset completion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 