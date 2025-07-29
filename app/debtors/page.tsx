'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  UserIcon,
  CurrencyDollarIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { useSearchParams } from 'next/navigation'

// Simple phone formatting function
const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

interface Person {
  id: string
  full_name: string
  first_name: string
  last_name: string
  ssn: string
  phone_numbers: {
    id: string
    number: string
    phone_type: string
    is_current: boolean
    is_verified: boolean
  }[]
}

interface DebtAccount {
  id: string
  account_number: string
  original_account_number: string
  external_id: string | null
  import_batch_id: string | null
  ssn: string | null
  original_creditor: string | null
  original_creditor_name: string | null
  original_balance: number | null
  current_balance: number | null
  last_payment_amount: number | null
  promise_to_pay_amount: number | null
  settlement_offered: number | null
  interest_rate: number | null
  late_fees: number | null
  collection_fees: number | null
  legal_fees: number | null
  total_fees: number | null
  payment_plan_amount: number | null
  account_type: string | null
  account_subtype: string | null
  account_status: string | null
  charge_off_date: string | null
  date_opened: string | null
  last_activity_date: string | null
  last_payment_date: string | null
  promise_to_pay_date: string | null
  next_payment_date: string | null
  status: string | null
  collection_status: string | null
  collection_priority: string | null
  contact_method: string | null
  contact_result: string | null
  contact_notes: string | null
  payment_plan_frequency: string | null
  payment_frequency: string | null
  total_payments: number | null
  payment_count: number | null
  average_payment: number | null
  largest_payment: number | null
  do_not_call: boolean | null
  hardship_declared: boolean | null
  hardship_type: string | null
  settlement_accepted: boolean | null
  data_source: string | null
  skip_trace_quality_score: number | null
  notes: string | null
  original_bank_name: string | null
  original_bank_routing_number: string | null
  original_bank_account_number: string | null
  original_bank_account_type: string | null
  original_bank_account_holder: string | null
  original_bank_verified: boolean | null
  original_bank_verification_date: string | null
  original_bank_verification_method: string | null
  portfolio_id: string | null
  client_id: string | null
  created_by: string | null
  person_id: string | null
  assigned_collector_id: string | null
  data_quality_score: number | null
  data_quality_risk_level: string | null
  data_quality_warnings: string | null
  data_quality_flags: string | null
  duplicate_notes: string | null
  created_at: string
  updated_at: string
  persons: Person & {
    phone_numbers: {
      id: string
      number: string
      phone_type: string
      is_current: boolean
      is_verified: boolean
    }[]
  }
  master_portfolios: {
    id: string
    name: string
    description: string | null
  } | null
  master_clients: {
    id: string
    name: string
    code: string
  } | null
  platform_users: {
    id: string
    full_name: string
    email: string
  } | null
}

export default function DebtorsPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [phoneSearch, setPhoneSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Check for PhoneNumber in URL parameters on component mount
  useEffect(() => {
    const phoneFromUrl = searchParams.get('PhoneNumber')
    if (phoneFromUrl) {
      setPhoneSearch(phoneFromUrl)
      console.log('Phone number from URL:', phoneFromUrl)
    }
  }, [searchParams])

  useEffect(() => {
    fetchDebtAccounts()
  }, [searchTerm, phoneSearch, statusFilter, priorityFilter])

  const fetchDebtAccounts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (searchTerm) params.append('search', searchTerm)
      if (phoneSearch) params.append('phone', phoneSearch)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)

      const response = await authenticatedFetch(`/api/debtors?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch debt accounts')
      }

      const data = await response.json()
      setDebtAccounts(data.data.debtAccounts || [])
    } catch (error) {
      console.error('Error fetching debt accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDebtAccounts = (debtAccounts || []).filter(debtAccount => {
    const matchesSearch = !searchTerm || 
      debtAccount.persons?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtAccount.account_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtAccount.original_creditor_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || debtAccount.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || debtAccount.collection_priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'settled': return 'bg-blue-100 text-blue-800'
      case 'bankruptcy': return 'bg-red-100 text-red-800'
      case 'deceased': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader title="Debt Accounts" />
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name, account, or creditor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="relative">
                  <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by phone number..."
                    value={phoneSearch}
                    onChange={(e) => setPhoneSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="settled">Settled</option>
                  <option value="bankruptcy">Bankruptcy</option>
                  <option value="deceased">Deceased</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full text-center py-8">
                  <p>Loading debt accounts...</p>
                </div>
              ) : filteredDebtAccounts.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-500">No debt accounts found matching your criteria.</p>
                </div>
              ) : (
                filteredDebtAccounts.map((debtAccount) => (
                  <Card key={debtAccount.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold">
                          {debtAccount.persons?.full_name || 'Unknown Person'}
                        </CardTitle>
                        <div className="flex gap-2">
                          <Badge className={getPriorityColor(debtAccount.collection_priority)}>
                            {debtAccount.collection_priority || 'normal'}
                          </Badge>
                          <Badge className={getStatusColor(debtAccount.status)}>
                            {debtAccount.status || 'unknown'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <UserIcon className="h-4 w-4" />
                        <span>Account: {debtAccount.account_number || 'N/A'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        <span>Balance: ${debtAccount.current_balance?.toLocaleString() || '0'}</span>
                      </div>
                      
                      {debtAccount.persons?.phone_numbers && debtAccount.persons.phone_numbers.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <PhoneIcon className="h-4 w-4" />
                          <span>
                            {formatPhoneNumber(debtAccount.persons.phone_numbers[0].number)}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPinIcon className="h-4 w-4" />
                        <span>Creditor: {debtAccount.original_creditor_name || 'Unknown'}</span>
                      </div>
                      
                      {debtAccount.last_payment_date && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <CalendarIcon className="h-4 w-4" />
                          <span>Last Payment: {new Date(debtAccount.last_payment_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 