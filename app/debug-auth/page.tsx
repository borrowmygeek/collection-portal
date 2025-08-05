'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DebugAuthPage() {
  const { user, session, profile, loading } = useAuth()
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [currentUrl, setCurrentUrl] = useState<string>('Loading...')
  const router = useRouter()

  useEffect(() => {
    // Set the current URL after component mounts to avoid hydration issues
    setCurrentUrl(window.location.href)
  }, [])

  useEffect(() => {
    const info = {
      timestamp: new Date().toISOString(),
      user: user ? {
        id: user.id,
        email: user.email,
        emailConfirmed: user.email_confirmed_at,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at
      } : null,
      session: session ? {
        accessToken: session.access_token ? 'Present' : 'Missing',
        refreshToken: session.refresh_token ? 'Present' : 'Missing',
        expiresAt: session.expires_at,
        expiresIn: session.expires_in
      } : null,
      profile: profile ? {
        id: profile.id,
        activeRole: profile.activeRole,
        availableRoles: profile.availableRoles,
        status: profile.status
      } : null,
      loading,
      url: currentUrl,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Server'
    }
    
    setDebugInfo(info)
    console.log('🔍 Debug Auth Info:', info)
  }, [user, session, profile, loading, currentUrl])

  const handleLoginClick = () => {
    console.log('🔄 Debug: Navigating to login page')
    router.push('/auth/login')
  }

  const handleDashboardClick = () => {
    console.log('🔄 Debug: Navigating to dashboard')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Debug</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Current State</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Loading:</span>
                <span className={loading ? 'text-yellow-600' : 'text-green-600'}>
                  {loading ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">User:</span>
                <span className={user ? 'text-green-600' : 'text-red-600'}>
                  {user ? 'Authenticated' : 'Not Authenticated'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Session:</span>
                <span className={session ? 'text-green-600' : 'text-red-600'}>
                  {session ? 'Active' : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Profile:</span>
                <span className={profile ? 'text-green-600' : 'text-red-600'}>
                  {profile ? 'Loaded' : 'Not Loaded'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">User Details</h2>
            {user ? (
              <div className="space-y-2">
                <div><strong>Email:</strong> {user.email}</div>
                <div><strong>ID:</strong> {user.id}</div>
                <div><strong>Email Confirmed:</strong> {user.email_confirmed_at ? 'Yes' : 'No'}</div>
                <div><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</div>
                <div><strong>Last Sign In:</strong> {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</div>
              </div>
            ) : (
              <p className="text-gray-500">No user authenticated</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Profile Details</h2>
            {profile ? (
              <div className="space-y-2">
                <div><strong>Active Role:</strong> {profile.activeRole.roleType}</div>
                <div><strong>Organization:</strong> {profile.activeRole.organizationType}</div>
                <div><strong>Organization ID:</strong> {profile.activeRole.organizationId || 'None'}</div>
                <div><strong>Status:</strong> {profile.status}</div>
                <div><strong>Full Name:</strong> {profile.full_name}</div>
                <div><strong>Available Roles:</strong> {profile.availableRoles.length}</div>
              </div>
            ) : (
              <p className="text-gray-500">No profile loaded</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Session Details</h2>
            {session ? (
              <div className="space-y-2">
                <div><strong>Access Token:</strong> {session.access_token ? 'Present' : 'Missing'}</div>
                <div><strong>Refresh Token:</strong> {session.refresh_token ? 'Present' : 'Missing'}</div>
                <div><strong>Expires At:</strong> {session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'Unknown'}</div>
                <div><strong>Expires In:</strong> {session.expires_in} seconds</div>
              </div>
            ) : (
              <p className="text-gray-500">No active session</p>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Raw Debug Info</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <div className="mt-8 flex space-x-4">
          <button
            onClick={handleLoginClick}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Go to Login
          </button>
          <button
            onClick={handleDashboardClick}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Refresh Page
          </button>
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Notes</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• User is authenticated: {user ? 'Yes' : 'No'}</li>
            <li>• Profile is loaded: {profile ? 'Yes' : 'No'}</li>
            <li>• Loading state: {loading ? 'Yes' : 'No'}</li>
            <li>• Current URL: {currentUrl}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}