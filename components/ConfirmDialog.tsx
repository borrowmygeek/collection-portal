'use client'

import { Dialog } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  requireNameVerification?: boolean
  verificationName?: string
  verificationPlaceholder?: string
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  requireNameVerification = false,
  verificationName = '',
  verificationPlaceholder = 'Enter the name to confirm'
}: ConfirmDialogProps) {
  const [verificationInput, setVerificationInput] = useState('')
  const [isVerificationValid, setIsVerificationValid] = useState(false)

  const handleVerificationChange = (value: string) => {
    setVerificationInput(value)
    setIsVerificationValid(value.toLowerCase() === verificationName.toLowerCase())
  }

  const handleConfirm = () => {
    if (requireNameVerification && !isVerificationValid) {
      return
    }
    onConfirm()
    onClose()
    setVerificationInput('')
    setIsVerificationValid(false)
  }

  const handleClose = () => {
    onClose()
    setVerificationInput('')
    setIsVerificationValid(false)
  }

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return 'text-red-600'
      case 'warning':
        return 'text-yellow-600'
      case 'info':
        return 'text-blue-600'
      default:
        return 'text-red-600'
    }
  }

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
      default:
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    }
  }

  const isConfirmDisabled = requireNameVerification && !isVerificationValid

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className={`h-6 w-6 ${getIconColor()}`} />
              </div>
              <div className="ml-3">
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  {title}
                </Dialog.Title>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                {message}
              </p>
            </div>

            {requireNameVerification && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-bold text-red-600">{verificationName}</span> to confirm deletion:
                </label>
                <input
                  type="text"
                  value={verificationInput}
                  onChange={(e) => handleVerificationChange(e.target.value)}
                  placeholder={verificationPlaceholder}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    verificationInput && !isVerificationValid 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300'
                  }`}
                />
                {verificationInput && !isVerificationValid && (
                  <p className="mt-1 text-sm text-red-600">
                    Name does not match. Please type the exact name.
                  </p>
                )}
              </div>
            )}
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className={`btn-primary ${getConfirmButtonColor()} ${
                  isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
} 