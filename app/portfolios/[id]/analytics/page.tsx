'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import { 
  ChartBarIcon,
  MapPinIcon,
  UserGroupIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline'

interface PortfolioStats {
  total_accounts: number
  total_balance: number
  average_balance: number
  average_debt_age_months: number
  average_credit_score: number
  state_distribution: Record<string, number>
  client_distribution: Record<string, number>
  account_type_distribution: Record<string, number>
  balance_range_distribution: Record<string, number>
  charge_off_date_distribution: Record<string, number>
  debt_age_distribution: Record<string, number>
  credit_score_distribution: Record<string, number>
}

interface Portfolio {
  id: string
  name: string
  description?: string
  status: string
  created_at: string
  client?: {
    id: string
    name: string
  }
}

export default function PortfolioAnalyticsPage() {
  const params = useParams()
  const { profile } = useAuth()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [stats, setStats] = useState<PortfolioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'geographic' | 'demographic' | 'financial' | 'temporal'>('overview')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch portfolio details
        const portfolioResponse = await authenticatedFetch(`/api/portfolios/${params.id}`)
        if (portfolioResponse.ok) {
          const portfolioData = await portfolioResponse.json()
          setPortfolio(portfolioData)
        }
        
        // Fetch portfolio stats
        const statsResponse = await authenticatedFetch(`/api/portfolios/${params.id}/stats`)
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatPercentage = (value: number, total: number) => {
    return ((value / total) * 100).toFixed(1)
  }

  const getTopStates = () => {
    if (!stats?.state_distribution) return []
    return Object.entries(stats.state_distribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
  }

  const getTopClients = () => {
    if (!stats?.client_distribution) return []
    return Object.entries(stats.client_distribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
  }

  const getBalanceRanges = () => {
    if (!stats?.balance_range_distribution) return []
    return Object.entries(stats.balance_range_distribution)
      .sort(([a], [b]) => {
        const aNum = parseInt(a.split('-')[0])
        const bNum = parseInt(b.split('-')[0])
        return aNum - bNum
      })
  }

  const getDebtAgeRanges = () => {
    if (!stats?.debt_age_distribution) return []
    return Object.entries(stats.debt_age_distribution)
      .sort(([a], [b]) => {
        const aNum = parseInt(a.split('-')[0])
        const bNum = parseInt(b.split('-')[0])
        return aNum - bNum
      })
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'geographic', name: 'Geographic', icon: MapPinIcon },
    { id: 'demographic', name: 'Demographic', icon: UserGroupIcon },
    { id: 'financial', name: 'Financial', icon: CurrencyDollarIcon },
    { id: 'temporal', name: 'Temporal', icon: CalendarIcon },
  ]

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen bg-gray-100">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <DashboardHeader />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
              <div className="container mx-auto px-6 py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading portfolio analytics...</p>
                </div>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !portfolio) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen bg-gray-100">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <DashboardHeader />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
              <div className="container mx-auto px-6 py-8">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Portfolio Not Found</h1>
                  <p className="mt-2 text-gray-600">{error}</p>
                </div>
              </div>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
            <div className="container mx-auto px-6 py-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => window.history.back()}
                      className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900">{portfolio.name}</h1>
                      <p className="mt-1 text-gray-600">
                        Portfolio Analytics • {portfolio.client?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      portfolio.status === 'active' ? 'bg-green-100 text-green-800' :
                      portfolio.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      portfolio.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      portfolio.status === 'returned' ? 'bg-orange-100 text-orange-800' :
                      portfolio.status === 'for_sale' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {portfolio.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Total Accounts
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {formatNumber(stats.total_accounts)}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Total Balance
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {formatCurrency(stats.total_balance)}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <ArrowTrendingUpIcon className="h-6 w-6 text-gray-400" />
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Average Balance
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {formatCurrency(stats.average_balance)}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <CalendarIcon className="h-6 w-6 text-gray-400" />
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Avg Debt Age
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {stats.average_debt_age_months} months
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="bg-white shadow rounded-lg">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8 px-6">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                          activeTab === tab.id
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <tab.icon className="h-4 w-4" />
                        <span>{tab.name}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="p-6">
                  {/* Overview Tab */}
                  {activeTab === 'overview' && stats && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Account Type Distribution */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Account Types</h3>
                          <div className="space-y-2">
                            {Object.entries(stats.account_type_distribution || {}).map(([type, count]) => (
                              <div key={type} className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">{type}</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-indigo-600 h-2 rounded-full" 
                                      style={{ width: `${(count / stats.total_accounts) * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatNumber(count)} ({formatPercentage(count, stats.total_accounts)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Credit Score Distribution */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Credit Score Ranges</h3>
                          <div className="space-y-2">
                            {Object.entries(stats.credit_score_distribution || {}).map(([range, count]) => (
                              <div key={range} className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">{range}</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-green-600 h-2 rounded-full" 
                                      style={{ width: `${(count / stats.total_accounts) * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatNumber(count)} ({formatPercentage(count, stats.total_accounts)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Geographic Tab */}
                  {activeTab === 'geographic' && stats && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-gray-900">State Distribution</h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="space-y-2">
                          {getTopStates().map(([state, count]) => (
                            <div key={state} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">{state}</span>
                              <div className="flex items-center space-x-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${(count / stats.total_accounts) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {formatNumber(count)} ({formatPercentage(count, stats.total_accounts)}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Demographic Tab */}
                  {activeTab === 'demographic' && stats && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-gray-900">Client Distribution</h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="space-y-2">
                          {getTopClients().map(([client, count]) => (
                            <div key={client} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">{client}</span>
                              <div className="flex items-center space-x-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-purple-600 h-2 rounded-full" 
                                    style={{ width: `${(count / stats.total_accounts) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {formatNumber(count)} ({formatPercentage(count, stats.total_accounts)}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Financial Tab */}
                  {activeTab === 'financial' && stats && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-gray-900">Balance Distribution</h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="space-y-2">
                          {getBalanceRanges().map(([range, count]) => (
                            <div key={range} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">${range}</span>
                              <div className="flex items-center space-x-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-green-600 h-2 rounded-full" 
                                    style={{ width: `${(count / stats.total_accounts) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {formatNumber(count)} ({formatPercentage(count, stats.total_accounts)}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Temporal Tab */}
                  {activeTab === 'temporal' && stats && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Debt Age Distribution */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Debt Age Distribution</h3>
                          <div className="space-y-2">
                            {getDebtAgeRanges().map(([range, count]) => (
                              <div key={range} className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">{range} months</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-orange-600 h-2 rounded-full" 
                                      style={{ width: `${(count / stats.total_accounts) * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatNumber(count)} ({formatPercentage(count, stats.total_accounts)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Charge-off Date Distribution */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Charge-off Date Distribution</h3>
                          <div className="space-y-2">
                            {Object.entries(stats.charge_off_date_distribution || {}).map(([year, count]) => (
                              <div key={year} className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">{year}</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-red-600 h-2 rounded-full" 
                                      style={{ width: `${(count / stats.total_accounts) * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatNumber(count)} ({formatPercentage(count, stats.total_accounts)}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
} 