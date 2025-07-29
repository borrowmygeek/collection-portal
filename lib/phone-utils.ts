/**
 * Phone number utility functions for the Collection Portal
 */

/**
 * Normalize a phone number by removing all non-digit characters
 * @param phoneNumber - The phone number to normalize
 * @returns The normalized phone number (digits only)
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return ''
  return phoneNumber.replace(/\D/g, '')
}

/**
 * Format a phone number for display
 * @param phoneNumber - The phone number to format
 * @returns The formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber)
  
  if (normalized.length === 10) {
    // US format: (XXX) XXX-XXXX
    return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`
  } else if (normalized.length === 11 && normalized.startsWith('1')) {
    // US format with country code: +1 (XXX) XXX-XXXX
    return `+1 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7)}`
  } else if (normalized.length === 11) {
    // International format: +XX XXX XXX XXXX
    return `+${normalized}`
  }
  
  // Return as-is if no standard format matches
  return phoneNumber
}

/**
 * Check if a phone number is valid (basic validation)
 * @param phoneNumber - The phone number to validate
 * @returns True if the phone number appears valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const normalized = normalizePhoneNumber(phoneNumber)
  
  // Basic validation: 10-15 digits
  if (normalized.length < 10 || normalized.length > 15) {
    return false
  }
  
  // Check if it starts with a valid country code or area code
  if (normalized.length === 11 && !normalized.startsWith('1')) {
    return false
  }
  
  return true
}

/**
 * Extract phone number from Vonage webhook format
 * @param webhookData - The webhook data string
 * @returns The extracted phone number or null
 */
export function extractPhoneFromVonageWebhook(webhookData: string): string | null {
  try {
    const params = new URLSearchParams(webhookData)
    const phoneNumber = params.get('PhoneNumber')
    return phoneNumber ? normalizePhoneNumber(phoneNumber) : null
  } catch (error) {
    console.error('Error extracting phone from Vonage webhook:', error)
    return null
  }
}

/**
 * Search for phone number variations (with/without country code, formatting)
 * @param phoneNumber - The phone number to search for
 * @returns Array of possible phone number variations
 */
export function getPhoneNumberVariations(phoneNumber: string): string[] {
  const normalized = normalizePhoneNumber(phoneNumber)
  const variations = [normalized]
  
  // Add variations with different formatting
  if (normalized.length === 10) {
    variations.push(`1${normalized}`) // Add country code
  } else if (normalized.length === 11 && normalized.startsWith('1')) {
    variations.push(normalized.slice(1)) // Remove country code
  }
  
  // Add formatted versions for partial matching
  if (normalized.length >= 7) {
    variations.push(normalized.slice(-7)) // Last 7 digits
  }
  
  return Array.from(new Set(variations)) // Remove duplicates
}

/**
 * Parse phone number from various input formats
 * @param input - The input string that might contain a phone number
 * @returns The extracted phone number or null
 */
export function parsePhoneNumber(input: string): string | null {
  // Remove common prefixes and suffixes
  const cleaned = input
    .replace(/^(tel:|phone:|call:)/i, '')
    .replace(/\s+/g, '')
    .trim()
  
  // Try to extract phone number using regex
  const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/
  const match = cleaned.match(phoneRegex)
  
  if (match) {
    const countryCode = match[1] || ''
    const areaCode = match[2]
    const prefix = match[3]
    const lineNumber = match[4]
    
    return normalizePhoneNumber(`${countryCode}${areaCode}${prefix}${lineNumber}`)
  }
  
  // If no regex match, try to extract just digits
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length >= 10 && digits.length <= 15) {
    return digits
  }
  
  return null
}