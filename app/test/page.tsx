'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function TestPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading authentication...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Not authenticated</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Authentication Test Page</h1>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
          <div className="space-y-2">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Email Confirmed:</strong> {user.email_confirmed_at ? 'Yes' : 'No'}</p>
            <p><strong>Created At:</strong> {user.created_at}</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
          {profile ? (
            <div className="space-y-2">
              <p><strong>Profile ID:</strong> {profile.id}</p>
              <p><strong>Full Name:</strong> {profile.full_name}</p>
              <p><strong>Role:</strong> {profile.role}</p>
              <p><strong>Status:</strong> {profile.status}</p>
              <p><strong>Agency ID:</strong> {profile.agency_id || 'None'}</p>
            </div>
          ) : (
            <p className="text-red-600">No profile found</p>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Navigation</h2>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/')}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Go to Dashboard
            </button>
            <br />
            <button
              onClick={() => router.push('/auth/login')}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Go to Login
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Raw Data</h2>
          <details className="text-sm">
            <summary className="cursor-pointer text-indigo-600">Click to view raw user data</summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto text-xs">
              {JSON.stringify(user, null, 2)}
            </pre>
          </details>
          <details className="text-sm mt-4">
            <summary className="cursor-pointer text-indigo-600">Click to view raw profile data</summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto text-xs">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}