'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Sidebar } from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronRight, Phone, Mail, MapPin, CreditCard, User, Building, FileText, DollarSign, Calendar, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'

interface Person {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  ssn: string | null
  person_phones: {
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
  processing_fee: number | null
  account_type: string | null
  account_subtype: string | null
  account_status: string | null
  charge_off_date: string | null
  date_opened: string | null
  last_activity_date: string | null
  last_payment_date: string | null
  promise_to_pay_date: string | null
  next_payment_date: string | null
  assigned_date: string | null
  last_contact_date: string | null
  next_contact_date: string | null
  last_skip_trace_date: string | null
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
  created_at: string
  updated_at: string
  original_bank_name: string | null
  original_bank_routing_number: string | null
  original_bank_account_number: string | null
  original_bank_account_type: string | null
  original_bank_account_holder: string | null
  original_bank_verified: boolean | null
  original_bank_verification_date: string | null
  original_bank_verification_method: string | null
  duplicate_notes: string | null
  data_quality_score: number | null
  data_quality_risk_level: string | null
  data_quality_warnings: string | null
  data_quality_flags: string | null
  persons: Person | null
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

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultCollapsed?: boolean
  hasData?: boolean
}

function CollapsibleSection({ title, icon, children, defaultCollapsed = false, hasData = true }: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed || !hasData)

  if (!hasData) {
    return null
  }

  return (
    <Card className="mb-4">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
          {children}
        </CardContent>
      )}
    </Card>
  )
}

function CollectorsInterface() {
  const { user } = useAuth()
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<DebtAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchDebtAccounts()
  }, [])

  const fetchDebtAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/debtors?limit=100')
      if (response.ok) {
        const data = await response.json()
        setDebtAccounts(data.data.debtAccounts || [])
        if (data.data.debtAccounts && data.data.debtAccounts.length > 0) {
          setSelectedAccount(data.data.debtAccounts[0])
        }
      }
    } catch (error) {
      console.error('Error fetching debt accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAccounts = debtAccounts.filter(account => 
    account.account_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.original_creditor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.persons?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.persons?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.persons?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'settled': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'bankruptcy': return 'bg-red-100 text-red-800 border-red-200'
      case 'deceased': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
        <DashboardHeader title="Collectors Interface" />
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Account List */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading accounts...</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedAccount?.id === account.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedAccount(account)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {account.account_number}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {account.persons?.full_name || `${account.persons?.first_name || ''} ${account.persons?.last_name || ''}`.trim() || 'Unknown Person'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {account.original_creditor_name || 'Unknown Creditor'}
                          </p>
                        </div>
                        <div className="ml-2 flex flex-col items-end">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(account.current_balance)}
                          </p>
                          <Badge className={`text-xs ${getPriorityColor(account.collection_priority)}`}>
                            {account.collection_priority || 'normal'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Account Details */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedAccount ? (
              <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">
                        Account: {selectedAccount.account_number}
                      </h1>
                      <p className="text-gray-600">
                        {selectedAccount.persons?.full_name || `${selectedAccount.persons?.first_name || ''} ${selectedAccount.persons?.last_name || ''}`.trim() || 'Unknown Person'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={getStatusColor(selectedAccount.status)}>
                        {selectedAccount.status || 'unknown'}
                      </Badge>
                      <Badge className={getPriorityColor(selectedAccount.collection_priority)}>
                        {selectedAccount.collection_priority || 'normal'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg border">
                      <p className="text-sm text-gray-500">Current Balance</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedAccount.current_balance)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <p className="text-sm text-gray-500">Original Balance</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedAccount.original_balance)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border">
                      <p className="text-sm text-gray-500">Days Since Last Payment</p>
                      <p className="text-xl font-bold text-gray-900">
                        {selectedAccount.last_payment_date ? 
                          Math.floor((Date.now() - new Date(selectedAccount.last_payment_date).getTime()) / (1000 * 60 * 60 * 24)) : 
                          'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Collapsible Sections */}
                <div className="space-y-6">
                  {/* Person Information */}
                  <CollapsibleSection 
                    title="Person Information" 
                    icon={<User className="h-5 w-5" />}
                    hasData={!!selectedAccount.persons}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                        <p className="text-gray-900">{selectedAccount.persons?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">SSN</Label>
                        <p className="text-gray-900">{selectedAccount.persons?.ssn || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">First Name</Label>
                        <p className="text-gray-900">{selectedAccount.persons?.first_name || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Last Name</Label>
                        <p className="text-gray-900">{selectedAccount.persons?.last_name || 'N/A'}</p>
                      </div>
                    </div>
                    
                    {selectedAccount.persons?.person_phones && selectedAccount.persons.person_phones.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium text-gray-700">Phone Numbers</Label>
                        <div className="mt-2 space-y-2">
                          {selectedAccount.persons.person_phones.map((phone) => (
                            <div key={phone.id} className="flex items-center space-x-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-900">{phone.number}</span>
                              <Badge variant="outline" className="text-xs">
                                {phone.phone_type}
                              </Badge>
                              {phone.is_current && (
                                <Badge className="bg-green-100 text-green-800 text-xs">Current</Badge>
                              )}
                              {phone.is_verified && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">Verified</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleSection>

                  {/* Account Details */}
                  <CollapsibleSection 
                    title="Account Details" 
                    icon={<CreditCard className="h-5 w-5" />}
                    hasData={true}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Account Number</Label>
                        <p className="text-gray-900">{selectedAccount.account_number}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Original Account Number</Label>
                        <p className="text-gray-900">{selectedAccount.original_account_number || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Account Type</Label>
                        <p className="text-gray-900">{selectedAccount.account_type || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Account Subtype</Label>
                        <p className="text-gray-900">{selectedAccount.account_subtype || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Date Opened</Label>
                        <p className="text-gray-900">{formatDate(selectedAccount.date_opened)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Charge Off Date</Label>
                        <p className="text-gray-900">{formatDate(selectedAccount.charge_off_date)}</p>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Financial Information */}
                  <CollapsibleSection 
                    title="Financial Information" 
                    icon={<DollarSign className="h-5 w-5" />}
                    hasData={true}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Current Balance</Label>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedAccount.current_balance)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Original Balance</Label>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedAccount.original_balance)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Interest Rate</Label>
                        <p className="text-gray-900">{selectedAccount.interest_rate ? `${selectedAccount.interest_rate}%` : 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Late Fees</Label>
                        <p className="text-gray-900">{formatCurrency(selectedAccount.late_fees)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Collection Fees</Label>
                        <p className="text-gray-900">{formatCurrency(selectedAccount.collection_fees)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Total Fees</Label>
                        <p className="text-gray-900">{formatCurrency(selectedAccount.total_fees)}</p>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Collection Information */}
                  <CollapsibleSection 
                    title="Collection Information" 
                    icon={<AlertTriangle className="h-5 w-5" />}
                    hasData={true}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Collection Status</Label>
                        <p className="text-gray-900">{selectedAccount.collection_status || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Collection Priority</Label>
                        <Badge className={getPriorityColor(selectedAccount.collection_priority)}>
                          {selectedAccount.collection_priority || 'normal'}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Last Contact Date</Label>
                        <p className="text-gray-900">{formatDate(selectedAccount.last_contact_date)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Next Contact Date</Label>
                        <p className="text-gray-900">{formatDate(selectedAccount.next_contact_date)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Contact Method</Label>
                        <p className="text-gray-900">{selectedAccount.contact_method || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Contact Result</Label>
                        <p className="text-gray-900">{selectedAccount.contact_result || 'N/A'}</p>
                      </div>
                    </div>
                    
                    {selectedAccount.contact_notes && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium text-gray-700">Contact Notes</Label>
                        <p className="text-gray-900 mt-1">{selectedAccount.contact_notes}</p>
                      </div>
                    )}
                  </CollapsibleSection>

                  {/* Payment Information */}
                  <CollapsibleSection 
                    title="Payment Information" 
                    icon={<CheckCircle className="h-5 w-5" />}
                    hasData={!!(selectedAccount.last_payment_amount || selectedAccount.payment_count || selectedAccount.total_payments)}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Last Payment Amount</Label>
                        <p className="text-gray-900">{formatCurrency(selectedAccount.last_payment_amount)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Last Payment Date</Label>
                        <p className="text-gray-900">{formatDate(selectedAccount.last_payment_date)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Total Payments</Label>
                        <p className="text-gray-900">{formatCurrency(selectedAccount.total_payments)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Payment Count</Label>
                        <p className="text-gray-900">{selectedAccount.payment_count || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Average Payment</Label>
                        <p className="text-gray-900">{formatCurrency(selectedAccount.average_payment)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Largest Payment</Label>
                        <p className="text-gray-900">{formatCurrency(selectedAccount.largest_payment)}</p>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Portfolio & Client Information */}
                  <CollapsibleSection 
                    title="Portfolio & Client Information" 
                    icon={<Building className="h-5 w-5" />}
                    hasData={!!(selectedAccount.master_portfolios || selectedAccount.master_clients)}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {selectedAccount.master_portfolios && (
                        <>
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Portfolio</Label>
                            <p className="text-gray-900">{selectedAccount.master_portfolios.name}</p>
                            {selectedAccount.master_portfolios.description && (
                              <p className="text-sm text-gray-500">{selectedAccount.master_portfolios.description}</p>
                            )}
                          </div>
                        </>
                      )}
                      {selectedAccount.master_clients && (
                        <>
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Client</Label>
                            <p className="text-gray-900">{selectedAccount.master_clients.name}</p>
                            <p className="text-sm text-gray-500">Code: {selectedAccount.master_clients.code}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </CollapsibleSection>

                  {/* Assigned Collector */}
                  <CollapsibleSection 
                    title="Assigned Collector" 
                    icon={<User className="h-5 w-5" />}
                    hasData={!!selectedAccount.platform_users}
                  >
                    {selectedAccount.platform_users ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Collector Name</Label>
                          <p className="text-gray-900">{selectedAccount.platform_users.full_name}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Email</Label>
                          <p className="text-gray-900">{selectedAccount.platform_users.email}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No collector assigned</p>
                    )}
                  </CollapsibleSection>

                  {/* Notes */}
                  <CollapsibleSection 
                    title="Notes" 
                    icon={<FileText className="h-5 w-5" />}
                    hasData={!!(selectedAccount.notes || selectedAccount.duplicate_notes)}
                  >
                    {selectedAccount.notes && (
                      <div className="mb-4">
                        <Label className="text-sm font-medium text-gray-700">Account Notes</Label>
                        <p className="text-gray-900 mt-1">{selectedAccount.notes}</p>
                      </div>
                    )}
                    {selectedAccount.duplicate_notes && (
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Duplicate Notes</Label>
                        <p className="text-gray-900 mt-1">{selectedAccount.duplicate_notes}</p>
                      </div>
                    )}
                  </CollapsibleSection>

                  {/* Data Quality */}
                  <CollapsibleSection 
                    title="Data Quality" 
                    icon={<AlertTriangle className="h-5 w-5" />}
                    hasData={!!(selectedAccount.data_quality_score || selectedAccount.data_quality_risk_level)}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Quality Score</Label>
                        <p className="text-gray-900">{selectedAccount.data_quality_score || 'N/A'}/100</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Risk Level</Label>
                        <Badge className={
                          selectedAccount.data_quality_risk_level === 'high' ? 'bg-red-100 text-red-800' :
                          selectedAccount.data_quality_risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          selectedAccount.data_quality_risk_level === 'low' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {selectedAccount.data_quality_risk_level || 'unknown'}
                        </Badge>
                      </div>
                    </div>
                    
                    {selectedAccount.data_quality_warnings && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium text-gray-700">Quality Warnings</Label>
                        <p className="text-gray-900 mt-1">{selectedAccount.data_quality_warnings}</p>
                      </div>
                    )}
                    
                    {selectedAccount.data_quality_flags && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium text-gray-700">Quality Flags</Label>
                        <p className="text-gray-900 mt-1">{selectedAccount.data_quality_flags}</p>
                      </div>
                    )}
                  </CollapsibleSection>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-20">
                <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg">Select an account to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CollectorsInterface
