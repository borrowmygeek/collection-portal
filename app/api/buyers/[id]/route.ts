import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'
import { sendAccountStatusUpdateEmail } from '@/lib/email'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: buyer, error } = await supabase
      .from('master_buyers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching buyer:', error)
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(buyer)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only platform admins can update buyers.' },
        { status: 403 }
      )
    }

    // Update the buyer
    const { data: buyer, error } = await supabase
      .from('master_buyers')
      .update({
        status: body.status,
        verification_notes: body.verification_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating buyer:', error)
      return NextResponse.json(
        { error: 'Failed to update buyer' },
        { status: 500 }
      )
    }

    // Send status update email if status changed
    // Temporarily disabled due to Resend API key configuration
    // if (body.status && buyer.status !== body.status) {
    //   try {
    //     await sendAccountStatusUpdateEmail(
    //       buyer.contact_email,
    //       buyer.company_name,
    //       buyer.contact_name,
    //       body.status
    //     )
    //   } catch (emailError) {
    //     console.error('Error sending status update email:', emailError)
    //     // Don't fail the request if email fails
    //   }
    // }

    return NextResponse.json(buyer)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Authenticate the request using the new system
    const authResult = await authenticateApiRequest(request)
    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const { user } = authResult

    // Check if user is platform admin
    if (user.activeRole.roleType !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only platform admins can delete buyers.' },
        { status: 403 }
      )
    }

    // Delete the buyer
    const { error } = await supabase
      .from('master_buyers')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting buyer:', error)
      return NextResponse.json(
        { error: 'Failed to delete buyer' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Buyer deleted successfully'
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 