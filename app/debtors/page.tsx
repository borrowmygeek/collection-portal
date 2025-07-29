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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

interface Person {
  id: string
  ssn: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  dob: string | null
  gender: string | null
  occupation: string | null
  employer: string | null
  do_not_call: boolean
  do_not_mail: boolean
  do_not_email: boolean
  do_not_text: boolean
  bankruptcy_filed: boolean
  active_military: boolean
}

interface Debtor {
  id: string
  person_id: string | null
  portfolio_id: string
  client_id: string
  account_number: string | null
  original_creditor: string | null
  original_creditor_name: string | null
  original_balance: number
  current_balance: number
  charge_off_date: string | null
  date_opened: string | null
  last_activity_date: string | null
  account_type: string
  account_subtype: string | null
  account_status: string
  collection_status: string
  collection_priority: string
  assigned_collector_id: string | null
  last_payment_amount: number | null
  last_payment_date: string | null
  total_payments: number
  payment_count: number
  last_contact_date: string | null
  next_contact_date: string | null
  do_not_call: boolean
  hardship_declared: boolean
  hardship_type: string | null
  data_source: string | null
  external_id: string | null
  notes: string | null
  created_by: string | null
  
  // NOTE: Original bank information fields (original_bank_name, original_bank_routing_number, 
  // original_bank_account_number, etc.) are intentionally NOT included in this interface
  // as they should only be displayed in account details view, not in general debtor information.
  
  persons: Person
  master_portfolios: {
    id: string
    name: string
    portfolio_type: string
  }
  master_clients: {
    id: string
    name: string
    code: string
  }
  platform_users: {
    id: string
    email: string
  } | null
}

export default function DebtorsPage() {
  const { user } = useAuth()
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  useEffect(() => {
    fetchDebtors()
  }, [])

  const fetchDebtors = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/debtors')
      if (response.ok) {
        const data = await response.json()
        // The API returns { debtors: [...], total: number, page: number, etc. }
        // We need to extract the debtors array from the response
        setDebtors(data.debtors || [])
      } else {
        console.error('Error fetching debtors:', response.status)
        setDebtors([]) // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching debtors:', error)
      setDebtors([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const filteredDebtors = (debtors || []).filter(debtor => {
    const matchesSearch = 
      debtor.account_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.original_creditor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.persons?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.persons?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.persons?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || debtor.collection_status === statusFilter
    const matchesPriority = priorityFilter === 'all' || debtor.collection_priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'contacted': return 'bg-yellow-100 text-yellow-800'
      case 'promise_to_pay': return 'bg-green-100 text-green-800'
      case 'payment_received': return 'bg-green-100 text-green-800'
      case 'resolved': return 'bg-gray-100 text-gray-800'
      case 'do_not_call': return 'bg-red-100 text-red-800'
      case 'bankruptcy': return 'bg-purple-100 text-purple-800'
      case 'deceased': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'high': return 'bg-yellow-100 text-yellow-800'
      case 'urgent': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader title="Debtors" />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader title="Debtors" />
        
        <div className="flex-1 overflow-y-auto p-6">
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Search by name, account number, or creditor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue value={statusFilter} placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="promise_to_pay">Promise to Pay</SelectItem>
                  <SelectItem value="payment_received">Payment Received</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="do_not_call">Do Not Call</SelectItem>
                  <SelectItem value="bankruptcy">Bankruptcy</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue value={priorityFilter} placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full sm:w-auto">
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Debtor
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {filteredDebtors.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500">No debtors found matching your criteria.</p>
                </CardContent>
              </Card>
            ) : (
              filteredDebtors.map((debtor) => (
                <Card key={debtor.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Person Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <UserIcon className="h-5 w-5 text-gray-400" />
                          <h3 className="text-lg font-semibold">
                            {debtor.persons?.full_name || `${debtor.persons?.first_name || ''} ${debtor.persons?.last_name || ''}`.trim() || 'Unknown Person'}
                          </h3>
                          {debtor.persons?.ssn && (
                            <Badge variant="outline" className="text-xs">
                              SSN: ***-**-{debtor.persons.ssn.slice(-4)}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <CurrencyDollarIcon className="h-4 w-4" />
                            <span>Account: {debtor.account_number || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Creditor: {debtor.original_creditor_name || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Balance: {formatCurrency(debtor.current_balance)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            <span>Charge-off: {formatDate(debtor.charge_off_date)}</span>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                          {/* Removed phone_primary, email_primary, address_line1, city, state, zipcode */}
                          {/* Assuming these fields are no longer directly available in the Debtor interface */}
                          {/* If they are needed, they would need to be fetched or passed as props */}
                        </div>
                      </div>

                      {/* Status and Actions */}
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-2">
                          <Badge className={getStatusColor(debtor.collection_status)}>
                            {debtor.collection_status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge className={getPriorityColor(debtor.collection_priority)}>
                            {debtor.collection_priority.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600 text-right">
                          <div>Portfolio: {debtor.master_portfolios?.name}</div>
                          <div>Client: {debtor.master_clients?.name}</div>
                          {debtor.platform_users && (
                            <div>Collector: {debtor.platform_users.email}</div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Compliance Flags */}
                    {(debtor.do_not_call || debtor.persons?.do_not_mail || debtor.persons?.do_not_email || debtor.persons?.do_not_text || debtor.persons?.bankruptcy_filed || debtor.hardship_declared) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex flex-wrap gap-2">
                          {debtor.do_not_call && <Badge variant="destructive">Do Not Call</Badge>}
                          {debtor.persons?.do_not_mail && <Badge variant="destructive">Do Not Mail</Badge>}
                          {debtor.persons?.do_not_email && <Badge variant="destructive">Do Not Email</Badge>}
                          {debtor.persons?.do_not_text && <Badge variant="destructive">Do Not Text</Badge>}
                          {debtor.persons?.bankruptcy_filed && <Badge variant="destructive">Bankruptcy</Badge>}
                          {debtor.hardship_declared && <Badge variant="destructive">Hardship</Badge>}
                        </div>
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
  )
} 