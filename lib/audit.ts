import { createSupabaseClient } from './supabase'

// Create Supabase client function - lazy-loaded to prevent build-time execution
function getAuditSupabaseClient() {
  return createSupabaseClient()
}

// Audit action types
export const AUDIT_ACTIONS = {
  // User management
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  ROLE_SWITCHED: 'ROLE_SWITCHED',
  GET_ROLES: 'GET_ROLES',
  
  // Data access
  DATA_VIEWED: 'DATA_VIEWED',
  DATA_CREATED: 'DATA_CREATED',
  DATA_UPDATED: 'DATA_UPDATED',
  DATA_DELETED: 'DATA_DELETED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_IMPORTED: 'DATA_IMPORTED',
  
  // Security events
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  
  // System events
  SYSTEM_CONFIG_CHANGED: 'SYSTEM_CONFIG_CHANGED',
  BACKUP_CREATED: 'BACKUP_CREATED',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  
  // API events
  API_CALL: 'API_CALL',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]

// Log user action
export async function logUserAction(
  userId: string,
  action: AuditAction,
  details: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const supabase = getAuditSupabaseClient()
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: action,
        details: details,
        ip_address: ipAddress,
        user_agent: userAgent,
        severity: 'info'
      })
  } catch (error) {
    console.error('Failed to log user action:', error)
  }
}

// Log security event
export async function logSecurityEvent(
  userId: string | null,
  action: AuditAction,
  details: Record<string, any> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    const supabase = getAuditSupabaseClient()
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: action,
        details: details,
        ip_address: ipAddress,
        user_agent: userAgent,
        severity: severity
      })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

// Log data access
export async function logDataAccess(
  userId: string,
  resourceType: string,
  resourceId: string,
  action: 'view' | 'create' | 'update' | 'delete' | 'export',
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const supabase = getAuditSupabaseClient()
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: `DATA_${action.toUpperCase()}` as AuditAction,
        details: {
          resource_type: resourceType,
          resource_id: resourceId,
          ...details
        },
        severity: 'info'
      })
  } catch (error) {
    console.error('Failed to log data access:', error)
  }
}

// Log data modification
export async function logDataModification(
  userId: string,
  resourceType: string,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  oldData?: Record<string, any>,
  newData?: Record<string, any>,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const supabase = getAuditSupabaseClient()
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: `DATA_${action.toUpperCase()}` as AuditAction,
        details: {
          resource_type: resourceType,
          resource_id: resourceId,
          old_data: oldData,
          new_data: newData,
          ...details
        },
        severity: 'medium'
      })
  } catch (error) {
    console.error('Failed to log data modification:', error)
  }
}

// Log API call
export async function logApiCall(
  userId: string | null,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const severity = statusCode >= 400 ? 'medium' : 'info'
    
    const supabase = getAuditSupabaseClient()
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'API_CALL',
        details: {
          endpoint,
          method,
          status_code: statusCode,
          response_time_ms: responseTime,
          ...details
        },
        severity
      })
  } catch (error) {
    console.error('Failed to log API call:', error)
  }
}

// Get audit logs for a user
export async function getUserAuditLogs(
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ data: any[] | null; error: any }> {
  try {
    const supabase = getAuditSupabaseClient()
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

// Get security events
export async function getSecurityEvents(
  severity?: 'low' | 'medium' | 'high' | 'critical',
  limit: number = 100,
  offset: number = 0
): Promise<{ data: any[] | null; error: any }> {
  try {
    const supabase = getAuditSupabaseClient()
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data, error } = await query
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
} 