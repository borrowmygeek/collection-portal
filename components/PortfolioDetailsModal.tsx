'use client'

import { Dialog } from '@headlessui/react'
import { XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

interface Client {
  id: string
  name: string
  code: string
  client_type: string
}

interface Portfolio {
  id: string
  name: string
  description: string
  client_id: string
  portfolio_type: string
  original_balance: number
  account_count: number
  charge_off_date: string | null
  debt_age_months: number | null
  average_balance: number | null
  credit_score_range: string
  status: string
  created_at: string
  updated_at: string | null
  client?: Client
}

interface PortfolioDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  portfolio: Portfolio | null
  onEdit: () => void
  onDelete: () => void
}

export default function PortfolioDetailsModal({
  isOpen,
  onClose,
  portfolio,
  onEdit,
  onDelete
}: PortfolioDetailsModalProps) {
  if (!portfolio) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const getTypeBadgeColor = (type: string) => {
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'returned':
        return 'bg-orange-100 text-orange-800'
      case 'for_sale':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCreditScoreLabel = (range: string) => {
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
        return range || 'Not specified'
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Portfolio Details
            </Dialog.Title>
            <div className="flex items-center space-x-2">
              <button
                onClick={onEdit}
                className="text-indigo-600 hover:text-indigo-900 p-1"
                title="Edit portfolio"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={onDelete}
                className="text-red-600 hover:text-red-900 p-1"
                title="Delete portfolio"
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
                  <h2 className="text-xl font-bold text-gray-900">{portfolio.name}</h2>
                  {portfolio.description && (
                    <p className="text-gray-600 mt-1">{portfolio.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getTypeBadgeColor(portfolio.portfolio_type)}`}>
                    {portfolio.portfolio_type.replace('_', ' ')}
                  </span>
                  <div className="mt-2">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(portfolio.status)}`}>
                      {portfolio.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-900 border-b pb-2">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Client</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {portfolio.client?.name || 'N/A'}
                    </p>
                    {portfolio.client?.code && (
                      <p className="text-xs text-gray-500">Code: {portfolio.client.code}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Portfolio Type</label>
                    <p className="text-sm text-gray-900 mt-1 capitalize">
                      {portfolio.portfolio_type.replace('_', ' ')}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Status</label>
                    <p className="text-sm text-gray-900 mt-1 capitalize">
                      {portfolio.status}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Credit Score Range</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {getCreditScoreLabel(portfolio.credit_score_range)}
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
                      {formatCurrency(portfolio.original_balance)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Account Count</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatNumber(portfolio.account_count)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Average Balance</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {portfolio.average_balance ? formatCurrency(portfolio.average_balance) : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Debt Age (Months)</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {portfolio.debt_age_months ? `${portfolio.debt_age_months} months` : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Charge-off Date</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDate(portfolio.charge_off_date)}
                    </p>
                  </div>
                </div>
              </div>
            </div>



            {/* Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-500">Created</label>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(portfolio.created_at)}
                </p>
              </div>
              
              {portfolio.updated_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(portfolio.updated_at)}
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