'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface Agency {
  id: string
  name: string
  code: string
  status: string
}

interface PortfolioPlacement {
  id: string
  portfolio_id: string
  agency_id: string
  client_id: string
  placement_amount: number
  placement_date: string
  return_date: string | null
  status: string
  account_count: number
  contingency_rate: number
  flat_fee_rate: number | null
  min_settlement_rate: number
  created_at: string
  agency?: Agency
}

interface Portfolio {
  id: string
  name: string
  client_id: string
  original_balance: number
  account_count: number
  status: string | null
}

interface PortfolioPlacementsModalProps {
  isOpen: boolean
  onClose: () => void
  portfolio: Portfolio | null
  onPlacementUpdated: () => void
}

export default function PortfolioPlacementsModal({
  isOpen,
  onClose,
  portfolio,
  onPlacementUpdated
}: PortfolioPlacementsModalProps) {
  const [placements, setPlacements] = useState<PortfolioPlacement[]>([])
  const [loading, setLoading] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedPlacement, setSelectedPlacement] = useState<PortfolioPlacement | null>(null)

  useEffect(() => {
    if (isOpen && portfolio) {
      fetchPlacements()
    }
  }, [isOpen, portfolio])

  const fetchPlacements = async () => {
    if (!portfolio) return

    try {
      setLoading(true)
      const response = await fetch(`/api/portfolio-placements?portfolio_id=${portfolio.id}`)
      if (response.ok) {
        const data = await response.json()
        setPlacements(data)
      } else {
        console.error('Error fetching placements:', response.statusText)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePlacement = (placement: PortfolioPlacement) => {
    setSelectedPlacement(placement)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedPlacement) return

    try {
      const response = await fetch(`/api/portfolio-placements/${selectedPlacement.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchPlacements()
        onPlacementUpdated()
      } else {
        const error = await response.json()
        alert(`Error deleting placement: ${error.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete placement')
    }
  }

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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'returned':
        return 'bg-orange-100 text-orange-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateTotalPlaced = () => {
    return placements.reduce((sum, p) => sum + p.placement_amount, 0)
  }

  const calculateTotalAccounts = () => {
    return placements.reduce((sum, p) => sum + p.account_count, 0)
  }

  if (!portfolio) return null

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-6xl w-full bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Portfolio Placements - {portfolio.name}
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Portfolio Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-blue-600">Original Balance</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatCurrency(portfolio.original_balance)}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-green-600">Total Placed</div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(calculateTotalPlaced())}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-purple-600">Total Accounts</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {formatNumber(calculateTotalAccounts())}
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-orange-600">Active Placements</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {placements.filter(p => p.status === 'active').length}
                  </div>
                </div>
              </div>

              {/* Placements Table */}
              <div className="bg-white rounded-lg border">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium text-gray-900">Agency Placements</h3>
                </div>
                
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  </div>
                ) : placements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Agency
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Placement Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Accounts
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contingency Rate
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Placement Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {placements.map((placement) => (
                          <tr key={placement.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {placement.agency?.name || 'N/A'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {placement.agency?.code || ''}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(placement.placement_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(placement.account_count)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {placement.contingency_rate}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(placement.status)}`}>
                                {placement.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(placement.placement_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleDeletePlacement(placement)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Delete placement"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <PlusIcon className="mx-auto h-12 w-12" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No placements found</h3>
                    <p className="text-sm text-gray-500">
                      This portfolio hasn't been placed with any agencies yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-sm w-full bg-white rounded-lg shadow-xl">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <XMarkIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Delete Placement
                  </Dialog.Title>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this placement? This action cannot be undone.
                </p>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleConfirmDelete()
                    setIsDeleteConfirmOpen(false)
                  }}
                  className="btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  )
} 