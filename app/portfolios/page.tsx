'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import PortfolioModal from '@/components/PortfolioModal'
import PortfolioDetailsModal from '@/components/PortfolioDetailsModal'
import PortfolioPlacementsModal from '@/components/PortfolioPlacementsModal'
import PlacePortfolioModal from '@/components/PlacePortfolioModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { MasterPortfolio } from '@/types/database'
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

export default function PortfoliosPage() {
  const { profile, session } = useAuth()
  const [portfolios, setPortfolios] = useState<MasterPortfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPlacementsModalOpen, setIsPlacementsModalOpen] = useState(false)
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedPortfolio, setSelectedPortfolio] = useState<MasterPortfolio | null>(null)
  const [editingPortfolio, setEditingPortfolio] = useState<MasterPortfolio | null>(null)

  useEffect(() => {
    fetchPortfolios()
  }, [])

  const fetchPortfolios = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/portfolios')
      if (response.ok) {
        const data = await response.json()
        setPortfolios(data)
      } else {
        console.error('Error fetching portfolios:', response.statusText)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPortfolios = portfolios.filter(portfolio => {
    const matchesSearch = portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (portfolio as any).client?.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || portfolio.portfolio_type === typeFilter
    const matchesStatus = statusFilter === 'all' || portfolio.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const handlePortfolioSaved = (portfolio: MasterPortfolio) => {
    fetchPortfolios() // Refresh the portfolios list
  }

  const handlePlacePortfolio = (portfolio: MasterPortfolio) => {
    setSelectedPortfolio(portfolio)
    setIsPlaceModalOpen(true)
  }

  const handlePortfolioPlaced = () => {
    fetchPortfolios() // Refresh the portfolios list
  }

  const handleViewPortfolio = (portfolio: MasterPortfolio) => {
    setSelectedPortfolio(portfolio)
    setIsDetailsModalOpen(true)
  }

  const handleEditPortfolio = (portfolio: MasterPortfolio) => {
    setEditingPortfolio(portfolio)
    setIsPortfolioModalOpen(true)
  }

  const handleViewPlacements = (portfolio: MasterPortfolio) => {
    setSelectedPortfolio(portfolio)
    setIsPlacementsModalOpen(true)
  }

  const handleDeletePortfolio = (portfolio: MasterPortfolio) => {
    setSelectedPortfolio(portfolio)
    setIsDeleteConfirmOpen(true)
  }

  const handlePortfolioUpdated = () => {
    fetchPortfolios() // Refresh the portfolios list
  }

  const handleConfirmDelete = async () => {
    if (!selectedPortfolio) return

    try {
      const response = await authenticatedFetch(`/api/portfolios/${selectedPortfolio.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchPortfolios() // Refresh the portfolios list
        setIsDeleteConfirmOpen(false)
        setSelectedPortfolio(null)
      } else {
        const error = await response.json()
        alert(`Error deleting portfolio: ${error.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete portfolio')
    }
  }

  const handleViewAnalytics = (portfolio: MasterPortfolio) => {
    window.location.href = `/portfolios/${portfolio.id}/analytics`
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
      case 'payday_cash_loan':
        return 'bg-pink-100 text-pink-800'
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

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          
          <main className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Portfolio Management</h1>
                  <p className="text-gray-600">Manage debt portfolios and placements</p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setIsPortfolioModalOpen(true)}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span>Add Portfolio</span>
                  </button>
                  <button 
                    onClick={() => window.location.href = '/debtors'}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <DocumentTextIcon className="h-5 w-5" />
                    <span>Debt Accounts</span>
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Portfolios</p>
                      <p className="text-2xl font-semibold text-gray-900">{portfolios.length}</p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Value</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(portfolios.reduce((sum, p) => sum + p.original_balance, 0))}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <UserGroupIcon className="h-8 w-8 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Accounts</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatNumber(portfolios.reduce((sum, p) => sum + p.account_count, 0))}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-8 w-8 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Active Portfolios</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {portfolios.filter(p => p.status === 'active').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="input-field pl-10"
                      placeholder="Search portfolios..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <FunnelIcon className="h-5 w-5 text-gray-400" />
                  <select
                    className="input-field"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="medical">Medical</option>
                    <option value="personal_loan">Personal Loan</option>
                    <option value="auto_loan">Auto Loan</option>
                    <option value="mortgage">Mortgage</option>
                    <option value="utility">Utility</option>
                    <option value="payday_cash_loan">Payday/Cash Loan</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    className="input-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="completed">Completed</option>
                    <option value="returned">Returned</option>
                    <option value="for_sale">For Sale</option>
                  </select>
                </div>
              </div>

              {/* Portfolios Table */}
              <div className="card">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredPortfolios.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Portfolio
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Client
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Accounts
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredPortfolios.map((portfolio) => (
                          <tr key={portfolio.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{portfolio.name}</div>
                                {portfolio.description && (
                                  <div className="text-sm text-gray-500 truncate max-w-xs">
                                    {portfolio.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{(portfolio as any).client?.name || 'N/A'}</div>
                              <div className="text-sm text-gray-500">{(portfolio as any).client?.code || ''}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(portfolio.portfolio_type || 'other')}`}>
                                {(portfolio.portfolio_type || 'other').replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(portfolio.original_balance)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(portfolio.account_count)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(portfolio.status || 'inactive')}`}>
                                {portfolio.status || 'inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {portfolio.created_at ? new Date(portfolio.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleViewPortfolio(portfolio)}
                                  className="text-gray-600 hover:text-gray-900 p-1"
                                  title="View portfolio details"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleViewAnalytics(portfolio)}
                                  className="text-purple-600 hover:text-purple-900 p-1"
                                  title="View analytics"
                                >
                                  <ChartBarIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleViewPlacements(portfolio)}
                                  className="text-blue-600 hover:text-blue-900 p-1"
                                  title="View placements"
                                >
                                  <DocumentTextIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEditPortfolio(portfolio)}
                                  className="text-indigo-600 hover:text-indigo-900 p-1"
                                  title="Edit portfolio"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePortfolio(portfolio)}
                                  className="text-red-600 hover:text-red-900 p-1"
                                  title="Delete portfolio"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handlePlacePortfolio(portfolio)}
                                  className="text-green-600 hover:text-green-900"
                                  disabled={portfolio.status !== 'active'}
                                  title={portfolio.status !== 'active' ? 'Only active portfolios can be placed' : 'Place portfolio with agency'}
                                >
                                  Place
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <DocumentTextIcon className="mx-auto h-12 w-12" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No portfolios found</h3>
                    <p className="text-sm text-gray-500">
                      {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Get started by creating your first portfolio.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Add Portfolio Modal */}
        <PortfolioModal
          isOpen={isPortfolioModalOpen}
          onClose={() => {
            setIsPortfolioModalOpen(false)
            setEditingPortfolio(null)
          }}
          onPortfolioSaved={handlePortfolioSaved}
          portfolio={editingPortfolio}
        />

        {/* Portfolio Details Modal */}
        <PortfolioDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false)
            setSelectedPortfolio(null)
          }}
          portfolio={selectedPortfolio as any}
          onEdit={() => {
            setIsDetailsModalOpen(false)
            setEditingPortfolio(selectedPortfolio)
            setIsPortfolioModalOpen(true)
          }}
          onDelete={() => {
            setIsDetailsModalOpen(false)
            setIsDeleteConfirmOpen(true)
          }}
        />

        {/* Portfolio Placements Modal */}
        <PortfolioPlacementsModal
          isOpen={isPlacementsModalOpen}
          onClose={() => {
            setIsPlacementsModalOpen(false)
            setSelectedPortfolio(null)
          }}
          portfolio={selectedPortfolio}
          onPlacementUpdated={handlePortfolioUpdated}
        />

        {/* Place Portfolio Modal */}
        <PlacePortfolioModal
          isOpen={isPlaceModalOpen}
          onClose={() => {
            setIsPlaceModalOpen(false)
            setSelectedPortfolio(null)
          }}
          onPortfolioPlaced={handlePortfolioPlaced}
          portfolio={selectedPortfolio}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => {
            setIsDeleteConfirmOpen(false)
            setSelectedPortfolio(null)
          }}
          onConfirm={handleConfirmDelete}
          title="Delete Portfolio"
          message={`Are you sure you want to delete "${selectedPortfolio?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          type="danger"
          requireNameVerification={true}
          verificationName={selectedPortfolio?.name || ''}
          verificationPlaceholder="Type the portfolio name to confirm deletion"
        />
      </div>
    </ProtectedRoute>
  )
}