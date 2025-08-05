'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string
  fallback?: React.ReactNode
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  console.log('🔒 ProtectedRoute: Loading auth state...', { user: !!user, profile: !!profile, loading })

  // Handle redirect to login using useEffect to avoid render-time redirects
  useEffect(() => {
    if (!loading && !user && !isRedirecting) {
      console.log('🔒 ProtectedRoute: No user, redirecting to login')
      setIsRedirecting(true)
      router.replace('/auth/login')
    }
  }, [loading, user, router, isRedirecting])

  // Wait for authentication to be determined
  if (loading) {
    console.log('🔒 ProtectedRoute: Still loading auth...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated and redirecting, show loading
  if (!user || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // If user is authenticated but profile is still loading, wait a bit longer
  if (!profile) {
    console.log('🔒 ProtectedRoute: User authenticated but profile not loaded yet...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  console.log('🔒 ProtectedRoute: Access granted')

  // Check user role and render appropriate content
  if (profile.activeRole.roleType === 'platform_admin') {
    return <>{children}</>
  } else if (profile.activeRole.roleType === 'agency_admin') {
    return <>{children}</>
  } else if (profile.activeRole.roleType === 'agency_user') {
    return <>{children}</>
  } else {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }
} 