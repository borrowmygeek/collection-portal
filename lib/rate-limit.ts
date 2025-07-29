interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, entry] of entries) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now()
  const key = `rate_limit:${identifier}`
  
  const entry = rateLimitStore.get(key)
  
  if (!entry || now > entry.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetTime: now + windowMs
    }
  }
  
  if (entry.count >= limit) {
    // Rate limit exceeded
    return {
      success: false,
      limit,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    }
  }
  
  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)
  
  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    resetTime: entry.resetTime
  }
}

// Convenience functions for common rate limiting scenarios
export async function rateLimitByIP(
  request: Request,
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<RateLimitResult> {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  return rateLimit(`ip:${ip}`, limit, windowMs)
}

export async function rateLimitByUser(
  userId: string,
  limit: number = 1000,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<RateLimitResult> {
  return rateLimit(`user:${userId}`, limit, windowMs)
}

export async function rateLimitByEndpoint(
  endpoint: string,
  identifier: string,
  limit: number = 50,
  windowMs: number = 5 * 60 * 1000 // 5 minutes
): Promise<RateLimitResult> {
  return rateLimit(`endpoint:${endpoint}:${identifier}`, limit, windowMs)
} 