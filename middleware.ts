import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Define public routes that don't require authentication
  const publicRoutes = ['/auth/login', '/auth/forgot-password', '/auth/reset-password', '/test', '/simple-test', '/debug-auth']
  const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  // Define routes that should be handled by client-side auth (no middleware redirects)
  const clientSideAuthRoutes = ['/', '/import', '/clients', '/agencies', '/portfolios', '/debtors', '/users', '/sales', '/security', '/migrations', '/buyers']
  const isClientSideAuthRoute = clientSideAuthRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  // Check for redirect loops by looking at referer
  const referer = req.headers.get('referer')
  const isRedirectLoop = referer && referer.includes('/auth/login') && req.nextUrl.pathname === '/auth/login'

  // --- BEGIN DIAGNOSTIC LOGGING ---
  console.log('🟡 [MIDDLEWARE] Incoming request:', req.nextUrl.pathname)
  console.log('🟡 [MIDDLEWARE] Referer:', referer)
  console.log('🟡 [MIDDLEWARE] Is redirect loop:', isRedirectLoop)
  console.log('🟡 [MIDDLEWARE] Route analysis:', {
    isPublicRoute,
    isClientSideAuthRoute,
    pathname: req.nextUrl.pathname
  })
  console.log('🟡 [MIDDLEWARE] All cookies:')
  for (const cookie of req.cookies.getAll()) {
    console.log(`    - ${cookie.name}: ${cookie.value}`)
  }
  // --- END DIAGNOSTIC LOGGING ---

  console.log('🔍 Middleware: Processing request for:', req.nextUrl.pathname, 'isPublicRoute:', isPublicRoute, 'isClientSideAuthRoute:', isClientSideAuthRoute)

  // Create a single response object that we'll modify
  let response = NextResponse.next({
    request: req,
  })

  // Add security headers to all responses
  const securityHeaders = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add Content Security Policy for better security
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co https://nczrnzqbthaqnrcupneu.supabase.co https://vercel.live",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "block-all-mixed-content",
    "upgrade-insecure-requests"
  ].join('; ')

  response.headers.set('Content-Security-Policy', cspHeader)

  // If we detect a redirect loop, allow the request to continue
  if (isRedirectLoop) {
    console.log('🟡 [MIDDLEWARE] Detected redirect loop, allowing request to continue')
    return response
  }

  // For public routes, always allow access (including /auth/login)
  if (isPublicRoute) {
    console.log('🟡 [MIDDLEWARE] Public route - allowing access')
    console.log('✅ Middleware: Allowing request to continue')
    return response
  }

  // For client-side auth routes, let the client handle authentication
  // This prevents middleware from interfering with client-side auth
  if (isClientSideAuthRoute) {
    console.log('🟡 [MIDDLEWARE] Client-side auth route - allowing client to handle authentication')
    console.log('✅ Middleware: Allowing request to continue (client-side auth will handle)')
    return response
  }

  // For all other routes, redirect to login
  // This catches any routes we haven't explicitly handled
  console.log('🔄 Middleware: Redirecting unhandled route to login')
  console.log('🟡 [MIDDLEWARE] Redirect details:', {
    from: req.nextUrl.pathname,
    to: '/auth/login',
    reason: 'Unhandled route'
  })
  const redirectResponse = NextResponse.redirect(new URL('/auth/login', req.url))
  // Add security headers to redirect response
  Object.entries(securityHeaders).forEach(([key, value]) => {
    redirectResponse.headers.set(key, value)
  })
  redirectResponse.headers.set('Content-Security-Policy', cspHeader)
  return redirectResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
} 