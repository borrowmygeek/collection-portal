import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailData {
  to: string
  subject: string
  html: string
  from?: string
}

export const sendEmail = async (emailData: EmailData) => {
  try {
    const { data, error } = await resend.emails.send({
      from: emailData.from || 'Collection Portal <noreply@collectionportal.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    })

    if (error) {
      console.error('Email send error:', error)
      throw new Error(`Failed to send email: ${error.message}`)
    }

    console.log('Email sent successfully:', data)
    return data
  } catch (error) {
    console.error('Email send exception:', error)
    throw error
  }
}

export const sendWelcomeEmail = async (email: string, companyName: string, contactName: string) => {
  const subject = `Welcome to Collection Portal - ${companyName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Collection Portal</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f46e5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Collection Portal</h1>
        </div>
        <div class="content">
          <h2>Hello ${contactName},</h2>
          <p>Welcome to Collection Portal! Your buyer account for <strong>${companyName}</strong> has been successfully registered.</p>
          
          <h3>What's Next?</h3>
          <ul>
            <li>Complete your NDA agreement to access portfolio sales</li>
            <li>Browse available debt portfolios</li>
            <li>Submit inquiries for portfolios of interest</li>
            <li>Access detailed analytics and portfolio information</li>
          </ul>
          
          <p>You can now log in to your account and start exploring available portfolios.</p>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/sales" class="button">View Available Portfolios</a>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>The Collection Portal Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} because you registered for Collection Portal.</p>
          <p>© 2024 Collection Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({ to: email, subject, html })
}

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`
  const subject = 'Reset Your Collection Portal Password'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello,</h2>
          <p>We received a request to reset your password for your Collection Portal account.</p>
          
          <a href="${resetUrl}" class="button">Reset Your Password</a>
          
          <div class="warning">
            <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          
          <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
          
          <p>Best regards,<br>The Collection Portal Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} because a password reset was requested.</p>
          <p>© 2024 Collection Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({ to: email, subject, html })
}

export const sendNDAConfirmationEmail = async (email: string, companyName: string, contactName: string) => {
  const subject = `NDA Agreement Confirmed - ${companyName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NDA Agreement Confirmed</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .success { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>NDA Agreement Confirmed</h1>
        </div>
        <div class="content">
          <h2>Hello ${contactName},</h2>
          <p>Great news! Your NDA agreement for <strong>${companyName}</strong> has been successfully confirmed.</p>
          
          <div class="success">
            <p><strong>✅ Your account is now fully active!</strong></p>
            <p>You now have full access to:</p>
            <ul>
              <li>Browse all available portfolios</li>
              <li>View detailed portfolio analytics</li>
              <li>Submit inquiries and offers</li>
              <li>Access portfolio documentation</li>
            </ul>
          </div>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/sales" class="button">Start Browsing Portfolios</a>
          
          <p>Thank you for completing the NDA process. We're excited to have you as part of our platform!</p>
          
          <p>Best regards,<br>The Collection Portal Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} to confirm your NDA agreement.</p>
          <p>© 2024 Collection Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({ to: email, subject, html })
}

export const sendAccountStatusUpdateEmail = async (email: string, companyName: string, contactName: string, status: string) => {
  const statusText = status === 'approved' ? 'Approved' : status === 'suspended' ? 'Suspended' : 'Updated'
  const statusColor = status === 'approved' ? '#059669' : status === 'suspended' ? '#dc2626' : '#6b7280'
  const subject = `Account Status ${statusText} - ${companyName}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Status Update</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: ${statusColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .status-box { background: ${status === 'approved' ? '#f0fdf4' : status === 'suspended' ? '#fef2f2' : '#f9fafb'}; border: 1px solid ${status === 'approved' ? '#bbf7d0' : status === 'suspended' ? '#fecaca' : '#e5e7eb'}; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Status ${statusText}</h1>
        </div>
        <div class="content">
          <h2>Hello ${contactName},</h2>
          <p>Your Collection Portal account status for <strong>${companyName}</strong> has been updated.</p>
          
          <div class="status-box">
            <p><strong>New Status: ${statusText.toUpperCase()}</strong></p>
            ${status === 'approved' ? '<p>Your account is now fully active and you can access all platform features.</p>' : 
              status === 'suspended' ? '<p>Your account has been temporarily suspended. Please contact support for more information.</p>' : 
              '<p>Your account status has been updated. Please log in to check your current access level.</p>'}
          </div>
          
          ${status === 'approved' ? `<a href="${process.env.NEXT_PUBLIC_APP_URL}/sales" class="button">Access Platform</a>` : 
            `<a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/login" class="button">Log In</a>`}
          
          <p>If you have any questions about this status change, please contact our support team.</p>
          
          <p>Best regards,<br>The Collection Portal Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} to notify you of an account status change.</p>
          <p>© 2024 Collection Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({ to: email, subject, html })
} 

export const sendUserAccountCreatedEmail = async (email: string, fullName: string, createdBy: string) => {
  const subject = 'Welcome to Collection Portal - Your Account Has Been Created'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Collection Portal</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f46e5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Collection Portal</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName},</h2>
          <p>Your account has been successfully created by <strong>${createdBy}</strong>.</p>
          
          <p>You can now log in to the platform using your email address and the password that was set up for you.</p>
          
          <p>If you need to reset your password, you can use the "Forgot Password" feature on the login page.</p>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/login" class="button">Log In to Your Account</a>
          
          <p>Welcome aboard!</p>
          
          <p>Best regards,<br>The Collection Portal Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} because your account was created.</p>
          <p>© 2024 Collection Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  return sendEmail({ to: email, subject, html })
}

export const sendRoleAssignmentEmail = async (email: string, fullName: string, roleType: string, organizationName: string, assignedBy: string) => {
  const subject = 'New Role Assignment - Collection Portal'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Role Assignment</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .role-box { background: #f3f4f6; border: 1px solid #d1d5db; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Role Assignment</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName},</h2>
          <p>You have been assigned a new role in Collection Portal:</p>
          
          <div class="role-box">
            <p><strong>Role:</strong> ${roleType.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Organization:</strong> ${organizationName}</p>
            <p><strong>Assigned by:</strong> ${assignedBy}</p>
          </div>
          
          <p>You can switch to this role using the role switcher in the platform.</p>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="button">Access Platform</a>
          
          <p>Best regards,<br>The Collection Portal Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} to notify you of a new role assignment.</p>
          <p>© 2024 Collection Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  return sendEmail({ to: email, subject, html })
}

export const sendImportJobCompletedEmail = async (email: string, fullName: string, jobName: string, status: string, details: string) => {
  const statusColor = status === 'completed' ? '#059669' : status === 'failed' ? '#dc2626' : '#6b7280'
  const subject = `Import Job ${status.charAt(0).toUpperCase() + status.slice(1)} - ${jobName}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Import Job ${status.charAt(0).toUpperCase() + status.slice(1)}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: ${statusColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .status-box { background: ${status === 'completed' ? '#f0fdf4' : status === 'failed' ? '#fef2f2' : '#f9fafb'}; border: 1px solid ${status === 'completed' ? '#bbf7d0' : status === 'failed' ? '#fecaca' : '#e5e7eb'}; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Import Job ${status.charAt(0).toUpperCase() + status.slice(1)}</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName},</h2>
          <p>Your import job <strong>${jobName}</strong> has been ${status}.</p>
          
          <div class="status-box">
            <p><strong>Status:</strong> ${status.toUpperCase()}</p>
            <p><strong>Details:</strong></p>
            <p>${details}</p>
          </div>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/import" class="button">View Import Results</a>
          
          <p>You can view the results in the import section of the platform.</p>
          
          <p>Best regards,<br>The Collection Portal Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} to notify you of an import job completion.</p>
          <p>© 2024 Collection Portal. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  return sendEmail({ to: email, subject, html })
} 