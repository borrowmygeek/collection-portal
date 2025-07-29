import { z } from 'zod'

// Base validation schemas
export const emailSchema = z.string().email('Invalid email format').min(1, 'Email is required')
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')
export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name too long')
export const phoneSchema = z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number').optional()
export const zipcodeSchema = z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional()

// User validation schemas
export const createUserSchema = z.object({
  email: emailSchema,
  full_name: nameSchema,
  role: z.enum(['platform_admin', 'agency_admin', 'agency_user']),
  password: passwordSchema,
  agency_id: z.string().uuid().optional()
})

export const updateUserSchema = z.object({
  full_name: nameSchema.optional(),
  role: z.enum(['platform_admin', 'agency_admin', 'agency_user']).optional(),
  agency_id: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional()
})

// Client validation schemas
export const createClientSchema = z.object({
  name: nameSchema,
  code: z.string().min(1, 'Code is required').max(20, 'Code too long').regex(/^[A-Z0-9_-]+$/, 'Code must contain only uppercase letters, numbers, hyphens, and underscores'),
  client_type: z.enum(['creditor', 'debt_buyer', 'servicer']),
  contact_email: emailSchema.optional(),
  contact_phone: phoneSchema,
  address_line1: z.string().max(100, 'Address too long').optional(),
  address_line2: z.string().max(100, 'Address too long').optional(),
  city: z.string().max(50, 'City name too long').optional(),
  state: z.string().length(2, 'State must be 2 characters').optional(),
  zipcode: zipcodeSchema,
  status: z.enum(['active', 'inactive', 'suspended']).default('active')
})

export const updateClientSchema = createClientSchema.partial()

// Portfolio validation schemas
export const createPortfolioSchema = z.object({
  name: nameSchema,
  description: z.string().max(500, 'Description too long').optional(),
  client_id: z.string().uuid('Invalid client ID'),
  portfolio_type: z.enum(['credit_card', 'medical', 'personal_loan', 'auto_loan', 'mortgage', 'utility', 'other']),
  original_balance: z.number().positive('Balance must be positive'),
  account_count: z.number().int().positive('Account count must be positive'),
  charge_off_date: z.string().datetime().optional(),
  debt_age_months: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive', 'completed', 'returned']).default('active')
})

export const updatePortfolioSchema = createPortfolioSchema.partial()

// Agency validation schemas
export const createAgencySchema = z.object({
  name: nameSchema,
  code: z.string().min(1, 'Code is required').max(20, 'Code too long').regex(/^[A-Z0-9_-]+$/, 'Code must contain only uppercase letters, numbers, hyphens, and underscores'),
  contact_email: emailSchema,
  contact_phone: phoneSchema,
  address_line1: z.string().max(100, 'Address too long').optional(),
  address_line2: z.string().max(100, 'Address too long').optional(),
  city: z.string().max(50, 'City name too long').optional(),
  state: z.string().length(2, 'State must be 2 characters').optional(),
  zipcode: zipcodeSchema,
  subscription_tier: z.enum(['basic', 'professional', 'enterprise']),
  status: z.enum(['active', 'inactive', 'suspended', 'provisioning']).default('provisioning')
})

export const updateAgencySchema = createAgencySchema.partial()

// Security filter validation schemas
export const securityFilterSchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  success: z.string().optional(),
  dateRange: z.enum(['1h', '24h', '7d', '30d']).optional()
})

// Input sanitization functions
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000) // Limit length
}

export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return ''
  
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9@._-]/g, '') // Only allow valid email characters
    .substring(0, 254) // RFC 5321 limit
}

export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return ''
  
  return phone
    .replace(/[^\d+\-\(\)\s]/g, '') // Only allow digits, +, -, (, ), and spaces
    .trim()
    .substring(0, 20)
}

export function sanitizeAddress(address: string): string {
  if (typeof address !== 'string') return ''
  
  return address
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 100)
}

export function sanitizeZipcode(zipcode: string): string {
  if (typeof zipcode !== 'string') return ''
  
  return zipcode
    .trim()
    .replace(/[^\d-]/g, '') // Only allow digits and hyphens
    .substring(0, 10)
}

// Validation helper functions
export async function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): Promise<{ success: true; data: T } | { success: false; errors: string[] }> {
  try {
    const validatedData = await schema.parseAsync(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      }
    }
    return { success: false, errors: ['Validation failed'] }
  }
}

export function sanitizeObject<T extends Record<string, any>>(obj: T, sanitizers: Record<keyof T, (value: any) => any>): T {
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (key in sanitizers) {
      sanitized[key] = sanitizers[key as keyof T](value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

// Common sanitizers for different data types
export const commonSanitizers = {
  email: sanitizeEmail,
  phone: sanitizePhone,
  name: sanitizeString,
  address: sanitizeAddress,
  zipcode: sanitizeZipcode,
  description: sanitizeString,
  code: (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
  status: (status: string) => status.trim().toLowerCase()
}

// XSS protection
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// SQL injection check (basic)
export function containsSqlInjection(text: string): boolean {
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i,
    /(\b(or|and)\b\s+\d+\s*=\s*\d+)/i,
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b\s+.*\bfrom\b)/i,
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b\s+.*\bwhere\b)/i,
    /(--|\/\*|\*\/|;)/,
    /(\bxp_|sp_|fn_)/i
  ]
  
  return sqlPatterns.some(pattern => pattern.test(text))
}

// Input validation middleware
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown) => {
    return await validateInput(schema, data)
  }
}