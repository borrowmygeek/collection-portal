'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import { 
  BuildingOfficeIcon, 
  CurrencyDollarIcon,
  ChartBarIcon,
  EyeIcon,
  CalendarIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import { PortfolioSale, SalesDashboardStats } from '@/types/sales'

interface SalesStats {
  total_available_portfolios: number
  total_portfolio_value: number
  average_portfolio_size: number
  total_buyers: number
  active_buyers: number
  total_inquiries: number
  pending_inquiries: number
}

export default function SalesPage() {
  const { profile } = useAuth()
  const [sales, setSales] = useState<PortfolioSale[]>([])
  const [stats, setStats] = useState<SalesStats>({
    total_available_portfolios: 0,
    total_portfolio_value: 0,
    average_portfolio_size: 0,
    total_buyers: 0,
    active_buyers: 0,
    total_inquiries: 0,
    pending_inquiries: 0
  })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)



  useEffect(() => {
    fetchSales()
    fetchStats()
  }, [page])

  const fetchSales = async () => {
    try {
      const response = await fetch(`/api/sales?page=${page}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setSales(data.sales)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/sales/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'sold':
        return 'bg-blue-100 text-blue-800'
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
            <div className="container mx-auto px-6 py-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Portfolio Sales</h1>
                <p className="mt-2 text-gray-600">
                  Browse available debt portfolios for purchase
                </p>
              </div>

              

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <BuildingOfficeIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Available Portfolios
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {stats.total_available_portfolios}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Value
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatCurrency(stats.total_portfolio_value)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Avg Portfolio Size
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {formatCurrency(stats.average_portfolio_size)}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <EyeIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Active Buyers
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {stats.active_buyers}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Portfolio Sales List */}
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Available Portfolios
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Browse portfolios available for purchase
                  </p>
                </div>

                {loading ? (
                  <div className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading portfolios...</p>
                  </div>
                ) : sales.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No portfolios available</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No portfolios are currently marked for sale.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <li key={sale.id} className="px-4 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-lg font-medium text-gray-900 truncate">
                                  {sale.portfolio?.name}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {sale.portfolio?.description}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(sale.sale_status)}`}>
                                  {sale.sale_status}
                                </span>
                              </div>
                            </div>
                            
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                              {sale.stats && (
                                <>
                                  <div className="flex items-center text-sm text-gray-500">
                                    <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                                    {formatCurrency(sale.stats.total_balance)} total
                                  </div>
                                  <div className="flex items-center text-sm text-gray-500">
                                    <ChartBarIcon className="h-4 w-4 mr-1" />
                                    {sale.stats.total_accounts.toLocaleString()} accounts
                                  </div>
                                  <div className="flex items-center text-sm text-gray-500">
                                    <CalendarIcon className="h-4 w-4 mr-1" />
                                    {sale.stats.average_debt_age_months} months avg
                                  </div>
                                </>
                              )}
                            </div>

                            {sale.asking_price && (
                              <div className="mt-2">
                                <span className="text-sm font-medium text-gray-900">
                                  Asking Price: {formatCurrency(sale.asking_price)}
                                </span>
                              </div>
                            )}

                            {sale.key_highlights && (
                              <div className="mt-2">
                                <p className="text-sm text-gray-600">
                                  <strong>Highlights:</strong> {sale.key_highlights}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex-shrink-0 flex space-x-2">
                            <button
                              onClick={() => window.location.href = `/portfolios/${sale.portfolio_id}/analytics`}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <ChartBarIcon className="h-4 w-4 mr-1" />
                              Analytics
                            </button>
                            <button
                              onClick={() => window.location.href = `/sales/${sale.id}`}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing page <span className="font-medium">{page}</span> of{' '}
                          <span className="font-medium">{totalPages}</span>
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
} 