'use client'

import { useState } from 'react'
import { authenticatedFetch } from '@/lib/supabase'

export default function TestApiPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testApi = async () => {
    setLoading(true)
    try {
      console.log('🧪 Testing API call...')
      const response = await authenticatedFetch('/api/test-auth')
      const data = await response.json()
      console.log('🧪 API Response:', { status: response.status, data })
      setResult({ status: response.status, data })
    } catch (error) {
      console.error('🧪 API Error:', error)
      setResult({ error: error })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      <button 
        onClick={testApi}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test API Authentication'}
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-bold">Result:</h2>
          <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}