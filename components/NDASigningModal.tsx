'use client'

import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/lib/supabase'
import { Dialog } from '@headlessui/react'
import { XMarkIcon, DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface NDASigningModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentVersion?: string
}

interface NDACompliance {
  is_compliant: boolean
  current_version: string
  user_version: string | null
  signed_at: string | null
  compliance_status: string
  message: string
}

export default function NDASigningModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentVersion = '1.0' 
}: NDASigningModalProps) {
  const [loading, setLoading] = useState(false)
  const [compliance, setCompliance] = useState<NDACompliance | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchCompliance()
    }
  }, [isOpen])

  const fetchCompliance = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/nda/compliance')
      if (response.ok) {
        const data = await response.json()
        setCompliance(data.compliance?.nda_compliance || null)
      } else {
        console.error('Error fetching NDA compliance:', response.status)
      }
    } catch (error) {
      console.error('Error fetching NDA compliance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignNDA = async () => {
    if (!agreed) {
      setError('You must agree to the terms before signing')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await authenticatedFetch('/api/nda/compliance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ndaVersion: currentVersion,
          documentHash: `nda_v${currentVersion}_${Date.now()}`,
          notes: 'User signed NDA through web interface'
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          onSuccess()
          onClose()
        } else {
          setError(data.error || 'Failed to sign NDA')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to sign NDA')
      }
    } catch (error) {
      console.error('Error signing NDA:', error)
      setError('Failed to sign NDA')
    } finally {
      setLoading(false)
    }
  }

  const isAlreadyCompliant = compliance?.is_compliant && compliance?.current_version === currentVersion

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-3">
              <DocumentTextIcon className="h-6 w-6 text-blue-600" />
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Non-Disclosure Agreement
              </Dialog.Title>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : isAlreadyCompliant ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  NDA Already Signed
                </h3>
                <p className="text-gray-600 mb-4">
                  You have already signed the current version of the NDA.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                  <p><strong>Version:</strong> {compliance?.user_version}</p>
                  <p><strong>Signed:</strong> {compliance?.signed_at ? new Date(compliance.signed_at).toLocaleDateString() : 'Unknown'}</p>
                  <p><strong>Status:</strong> {compliance?.compliance_status}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Version {currentVersion} - Standard NDA Agreement
                  </h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-gray-700">
                    <p className="mb-3">
                      This Non-Disclosure Agreement (NDA) governs the sharing of confidential information 
                      related to debt portfolios and sales data.
                    </p>
                    <p className="mb-3">
                      By signing this agreement, you agree to maintain the confidentiality of all shared 
                      information and use it solely for authorized business purposes.
                    </p>
                    <p className="mb-3">
                      <strong>Key Terms:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Maintain strict confidentiality of all shared information</li>
                      <li>Use information only for authorized business purposes</li>
                      <li>Not disclose information to unauthorized parties</li>
                      <li>Return or destroy confidential information when requested</li>
                      <li>Comply with all applicable laws and regulations</li>
                    </ul>
                    <p className="mt-3 text-xs text-gray-500">
                      This agreement is legally binding and enforceable under applicable law.
                    </p>
                  </div>
                </div>

                {compliance && !compliance.is_compliant && (
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">Current Status</h4>
                    <p className="text-sm text-yellow-700">{compliance.message}</p>
                    {compliance.user_version && (
                      <p className="text-sm text-yellow-600 mt-1">
                        You previously signed version {compliance.user_version}
                      </p>
                    )}
                  </div>
                )}

                <div className="mb-6">
                  <label className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      I have read, understood, and agree to the terms of this Non-Disclosure Agreement. 
                      I acknowledge that this agreement is legally binding and enforceable.
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSignNDA}
                    disabled={loading || !agreed}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Signing...' : 'Sign NDA'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
} 