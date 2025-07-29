'use client'

import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'

export default function SimpleTestPage() {
  const { user, profile, loading } = useAuth()
  const [testResults, setTestResults] = useState<string[]>([])

  useEffect(() => {
    const results = []
    
    // Test 1: Authentication loading
    results.push(`1. Auth Loading: ${loading}`)
    
    // Test 2: User object
    if (user) {
      results.push(`2. User Found: ${user.email} (${user.id})`)
    } else {
      results.push(`2. User: ${user}`)
    }
    
    // Test 3: Profile object
    if (profile) {
      results.push(`3. Profile Found: ${profile.full_name} (${profile.role})`)
    } else {
      results.push(`3. Profile: ${profile}`)
    }
    
    // Test 4: Navigation test
    results.push(`4. Current URL: ${window.location.href}`)
    
    setTestResults(results)
  }, [user, profile, loading])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Simple Authentication Test</h1>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Results</h2>
          <div className="space-y-2">
            {testResults.map((result, index) => (
              <p key={index} className="text-sm font-mono bg-gray-100 p-2 rounded">
                {result}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Manual Navigation Test</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Try these direct links:</p>
              <a 
                href="/" 
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 mr-4"
              >
                Dashboard (Direct Link)
              </a>
              <a 
                href="/auth/login" 
                className="inline-block bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Login (Direct Link)
              </a>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Or try these programmatic navigations:</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mr-4"
              >
                Dashboard (window.location)
              </button>
              <button 
                onClick={() => window.location.href = '/auth/login'}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Login (window.location)
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Raw Data</h2>
          <details className="text-sm">
            <summary className="cursor-pointer text-indigo-600">User Object</summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto text-xs">
              {JSON.stringify(user, null, 2)}
            </pre>
          </details>
          <details className="text-sm mt-4">
            <summary className="cursor-pointer text-indigo-600">Profile Object</summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto text-xs">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}