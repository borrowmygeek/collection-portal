import { createClient } from '@supabase/supabase-js'

// Create admin client function - lazy-loaded to prevent build-time execution
function createAuditSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export interface AuditEvent {
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  details: any
  ip_address?: string
  user_agent?: string
  success: boolean
  error_message?: string
}

export interface AuditLogEntry extends AuditEvent {
  id: string
  created_at: string
  session_id?: string
}

// Security event types
export const AUDIT_ACTIONS = {
  // Authentication events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',
  SESSION_EXPIRED: 'session_expired',
  
  // Data access events
  DATA_VIEW: 'data_view',
  DATA_CREATE: 'data_create',
  DATA_UPDATE: 'data_update',
  DATA_DELETE: 'data_delete',
  DATA_EXPORT: 'data_export',
  DATA_IMPORT: 'data_import',
  
  // User management events
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_ROLE_CHANGE: 'user_role_change',
  
  // System events
  CONFIGURATION_CHANGE: 'configuration_change',
  SECURITY_VIOLATION: 'security_violation',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  
  // Import/Export events
  IMPORT_START: 'import_start',
  IMPORT_COMPLETE: 'import_complete',
  IMPORT_FAILED: 'import_failed',
  EXPORT_START: 'export_start',
  EXPORT_COMPLETE: 'export_complete',
  EXPORT_FAILED: 'export_failed'
} as const

export async function logAuditEvent(
  event: Omit<AuditEvent, 'created_at'>,
  request?: Request
): Promise<void> {
  try {
    // Extract additional context from request if available
    const ipAddress = request?.headers.get('x-forwarded-for') || 
                     request?.headers.get('x-real-ip') || 
                     'unknown'
    
    const userAgent = request?.headers.get('user-agent') || 'unknown'
    
    const auditEntry: Omit<AuditLogEntry, 'id' | 'created_at'> = {
      ...event,
      ip_address: ipAddress,
      user_agent: userAgent,
      session_id: request?.headers.get('x-session-id') || undefined
    }

    // Insert into audit_logs table
    const supabaseAdmin = createAuditSupabaseClient()
    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert(auditEntry)

    if (error) {
      console.error('Failed to log audit event:', error)
      // Don't throw - audit logging should not break the main flow
    }
  } catch (error) {
    console.error('Error in audit logging:', error)
    // Don't throw - audit logging should not break the main flow
  }
}

// Convenience functions for common audit events
export async function logSecurityEvent(
  userId: string,
  action: string,
  details: any,
  success: boolean = true,
  errorMessage?: string,
  request?: Request
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action,
    resource_type: 'security',
    details,
    success,
    error_message: errorMessage
  }, request)
}

export async function logDataAccess(
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details: any = {},
  request?: Request
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    success: true
  }, request)
}

export async function logUserAction(
  userId: string,
  action: string,
  targetUserId: string,
  details: any = {},
  request?: Request
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action,
    resource_type: 'user',
    resource_id: targetUserId,
    details,
    success: true
  }, request)
}

// High-level audit functions
export async function logLoginAttempt(
  userId: string,
  success: boolean,
  errorMessage?: string,
  request?: Request
): Promise<void> {
  await logSecurityEvent(
    userId,
    success ? AUDIT_ACTIONS.LOGIN_SUCCESS : AUDIT_ACTIONS.LOGIN_FAILED,
    { timestamp: new Date().toISOString() },
    success,
    errorMessage,
    request
  )
}

export async function logDataModification(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  changes: any,
  request?: Request
): Promise<void> {
  await logDataAccess(
    userId,
    action,
    resourceType,
    resourceId,
    { changes, timestamp: new Date().toISOString() },
    request
  )
}

export async function logImportEvent(
  userId: string,
  action: string,
  jobId: string,
  details: any,
  success: boolean = true,
  errorMessage?: string,
  request?: Request
): Promise<void> {
  await logAuditEvent({
    user_id: userId,
    action,
    resource_type: 'import_job',
    resource_id: jobId,
    details,
    success,
    error_message: errorMessage
  }, request)
} 