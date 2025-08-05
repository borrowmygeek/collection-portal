'use client'

import { useState } from 'react'
import { useNDACompliance } from '@/lib/hooks/useNDACompliance'
import NDASigningModal from './NDASigningModal'
import { 
  ExclamationTriangleIcon, 
  DocumentTextIcon,
  ShieldCheckIcon 
} from '@heroicons/react/24/outline'

interface NDAComplianceWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  showComplianceStatus?: boolean
}

export default function NDAComplianceWrapper({ 
  children, 
  fallback,
  showComplianceStatus = true 
}: NDAComplianceWrapperProps) {
  const { 
    isCompliant, 
    loading, 
    error, 
    currentVersion, 
    complianceStatus, 
    complianceMessage,
    refreshCompliance 
  } = useNDACompliance()
  
  const [showNDAModal, setShowNDAModal] = useState(false)

  const handleNDASuccess = () => {
    refreshCompliance()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Checking NDA compliance...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
          <h3 className="text-sm font-medium text-red-800">Error</h3>
        </div>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (!isCompliant) {
    return (
      <div className="space-y-4">
        {showComplianceStatus && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
              <h3 className="text-sm font-medium text-yellow-800">NDA Compliance Required</h3>
            </div>
            <p className="mt-1 text-sm text-yellow-700">{complianceMessage}</p>
            {complianceStatus === 'version_mismatch' && (
              <p className="mt-1 text-sm text-yellow-600">
                Current version: {currentVersion} | Your version: {complianceStatus}
              </p>
            )}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            NDA Signature Required
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            To access sales information and buyer features, you must sign the current 
            version of our Non-Disclosure Agreement.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => setShowNDAModal(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <DocumentTextIcon className="h-4 w-4 mr-2" />
              Sign NDA
            </button>
            
            {fallback && (
              <div className="pt-4 border-t border-gray-200">
                {fallback}
              </div>
            )}
          </div>
        </div>

        <NDASigningModal
          isOpen={showNDAModal}
          onClose={() => setShowNDAModal(false)}
          onSuccess={handleNDASuccess}
          currentVersion={currentVersion}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showComplianceStatus && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-5 w-5 text-green-400 mr-2" />
            <h3 className="text-sm font-medium text-green-800">NDA Compliant</h3>
          </div>
          <p className="mt-1 text-sm text-green-700">
            You have signed the current NDA (v{currentVersion}) and have full access to sales information.
          </p>
        </div>
      )}
      
      {children}
    </div>
  )
} 