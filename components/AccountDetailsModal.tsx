'use client'

import { Dialog } from '@headlessui/react'
import { XMarkIcon, PencilIcon, TrashIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

interface Portfolio {
  id: string
  name: string
  description: string
}

interface Client {
  id: string
  name: string
  code: string
}

interface Account {
  id: string
  account_number: string
  account_type: string | null
  charge_off_date: string | null
  client_id: string
  created_at: string | null
  credit_score_range: string | null
  current_balance: number
  date_opened: string | null
  debt_age_months: number | null
  geographic_state: string | null
  original_balance: number
  original_creditor: string | null
  portfolio_id: string
  status: string | null
  updated_at: string | null
  portfolio?: Portfolio
  client?: Client
}

interface AccountDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  account: Account | null
  onEdit: () => void
  onDelete: () => void
}

export default function AccountDetailsModal({
  isOpen,
  onClose,
  account,
  onEdit,
  onDelete
}: AccountDetailsModalProps) {
  if (!account) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const getTypeBadgeColor = (type: string | null) => {
    switch (type) {
      case 'credit_card':
        return 'bg-blue-100 text-blue-800'
      case 'medical':
        return 'bg-green-100 text-green-800'
      case 'personal_loan':
        return 'bg-purple-100 text-purple-800'
      case 'auto_loan':
        return 'bg-yellow-100 text-yellow-800'
      case 'mortgage':
        return 'bg-red-100 text-red-800'
      case 'utility':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-red-100 text-red-800'
      case 'resolved':
        return 'bg-blue-100 text-blue-800'
      case 'returned':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCreditScoreLabel = (range: string | null) => {
    if (!range) return 'Not specified'
    switch (range) {
      case '300-499':
        return '300-499 (Poor)'
      case '500-599':
        return '500-599 (Fair)'
      case '600-699':
        return '600-699 (Good)'
      case '700-799':
        return '700-799 (Very Good)'
      case '800-850':
        return '800-850 (Excellent)'
      case 'unknown':
        return 'Unknown'
      default:
        return range
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Account Details
            </Dialog.Title>
            <div className="flex items-center space-x-2">
              <button
                onClick={onEdit}
                className="text-indigo-600 hover:text-indigo-900 p-1"
                title="Edit account"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={onDelete}
                className="text-red-600 hover:text-red-900 p-1"
                title="Delete account"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Header Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 font-mono">
                    {account.account_number}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {account.original_creditor || 'No creditor specified'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getTypeBadgeColor(account.account_type)}`}>
                    {account.account_type ? account.account_type.replace('_', ' ') : 'Unknown'}
                  </span>
                  <div className="mt-2">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(account.status)}`}>
                      {account.status || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-900 border-b pb-2">Account Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Account Number</label>
                    <p className="text-sm font-mono text-gray-900 mt-1">
                      {account.account_number}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Account Type</label>
                    <p className="text-sm text-gray-900 mt-1 capitalize">
                      {account.account_type ? account.account_type.replace('_', ' ') : 'Not specified'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Original Creditor</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {account.original_creditor || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Status</label>
                    <p className="text-sm text-gray-900 mt-1 capitalize">
                      {account.status || 'Not specified'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Credit Score Range</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {getCreditScoreLabel(account.credit_score_range)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Geographic State</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {account.geographic_state || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-900 border-b pb-2">Financial Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Original Balance</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatCurrency(account.original_balance)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Current Balance</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatCurrency(account.current_balance)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Debt Age (Months)</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {account.debt_age_months ? `${account.debt_age_months} months` : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Date Opened</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDate(account.date_opened)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Charge-off Date</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDate(account.charge_off_date)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Portfolio & Client Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 border-b pb-2">Portfolio & Client</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <BuildingOfficeIcon className="h-5 w-5 text-blue-600" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-900">Portfolio</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        {account.portfolio?.name || 'Unknown Portfolio'}
                      </p>
                      {account.portfolio?.description && (
                        <p className="text-xs text-blue-600 mt-1">
                          {account.portfolio.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <BuildingOfficeIcon className="h-5 w-5 text-green-600" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-900">Client</h4>
                      <p className="text-sm text-green-700 mt-1">
                        {account.client?.name || 'Unknown Client'}
                      </p>
                      {account.client?.code && (
                        <p className="text-xs text-green-600 mt-1">
                          Code: {account.client.code}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-500">Created</label>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(account.created_at)}
                </p>
              </div>
              
              {account.updated_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(account.updated_at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
} 