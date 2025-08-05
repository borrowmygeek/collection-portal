'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline'

import { MasterBuyer } from '@/types/sales'

export default function BuyersPage() {
  const { profile, isPlatformAdmin } = useAuth()
  const [buyers, setBuyers] = useState<MasterBuyer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ndaFilter, setNdaFilter] = useState('all')
  const [selectedBuyer, setSelectedBuyer] = useState<MasterBuyer | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [registrationForm, setRegistrationForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    verification_notes: ''
  })
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationError, setRegistrationError] = useState('')

  useEffect(() => {
    fetchBuyers()
  }, [])

  const fetchBuyers = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/buyers')
      if (response.ok) {
        const data = await response.json()
        setBuyers(data.buyers || [])
      } else {
        console.error('Error fetching buyers:', response.status)
      }
    } catch (error) {
      console.error('Error fetching buyers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBuyers = buyers.filter(buyer => {
    const matchesSearch = buyer.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         buyer.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         buyer.contact_email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || buyer.status === statusFilter
    const matchesNda = ndaFilter === 'all' || 
                      (ndaFilter === 'signed' && buyer.nda_signed) ||
                      (ndaFilter === 'pending' && !buyer.nda_signed)
    return matchesSearch && matchesStatus && matchesNda
  })

  const handleStatusUpdate = async (buyerId: string, newStatus: string) => {
    try {
      const response = await authenticatedFetch(`/api/buyers/${buyerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        // Update the local state
        setBuyers(prev => prev.map(buyer => 
          buyer.id === buyerId 
            ? { ...buyer, status: newStatus as any }
            : buyer
        ))
      } else {
        throw new Error('Failed to update buyer status')
      }
    } catch (error) {
      console.error('Error updating buyer status:', error)
    }
  }

  const getStatusBadge = (status: string, ndaSigned: boolean, complianceStatus?: string, currentVersion?: string, signedVersion?: string) => {
    // Check NDA compliance first
    if (complianceStatus === 'non_compliant') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
          NDA Non-Compliant
        </span>
      )
    }

    if (complianceStatus === 'compliant') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          NDA Compliant
        </span>
      )
    }

    if (!ndaSigned) {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
          <ClockIcon className="h-3 w-3 mr-1" />
          Pending NDA
        </span>
      )
    }

    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Approved
          </span>
        )
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Suspended
          </span>
        )
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Pending
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegistrationLoading(true)
    setRegistrationError('')

    try {
      const response = await authenticatedFetch('/api/buyers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationForm),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Registration failed')
      }

      // Reset form and close modal
      setRegistrationForm({
        company_name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        website: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'USA',
        verification_notes: ''
      })
      setShowRegistrationForm(false)
      
      // Refresh the buyers list
      await fetchBuyers()
    } catch (err) {
      setRegistrationError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegistrationLoading(false)
    }
  }

  const handleFormChange = (field: string, value: string) => {
    setRegistrationForm(prev => ({ ...prev, [field]: value }))
    setRegistrationError('')
  }

  if (!isPlatformAdmin) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen bg-gray-100">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <DashboardHeader />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
              <div className="container mx-auto px-6 py-8">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
                  <p className="mt-2 text-gray-600">
                    You don't have permission to view this page.
                  </p>
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
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          
          <main className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Buyers</h1>
                  <p className="text-gray-600">Manage buyer registrations and NDA approvals</p>
                </div>
                <button
                  onClick={() => setShowRegistrationForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <UserPlusIcon className="h-4 w-4 mr-2" />
                  Register New Buyer
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-6 w-6 text-gray-400">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Buyers
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {buyers.length}
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
                        <CheckCircleIcon className="h-6 w-6 text-green-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Approved
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {buyers.filter(b => b.status === 'approved' && b.nda_signed).length}
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
                        <ClockIcon className="h-6 w-6 text-yellow-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Pending NDA
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {buyers.filter(b => !b.nda_signed).length}
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
                        <XCircleIcon className="h-6 w-6 text-red-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Suspended
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {buyers.filter(b => b.status === 'suspended').length}
                          </dd>
                        </dl>
                      </div>
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
                      placeholder="Search buyers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <FunnelIcon className="h-5 w-5 text-gray-400" />
                  <select
                    className="input-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <FunnelIcon className="h-5 w-5 text-gray-400" />
                  <select
                    className="input-field"
                    value={ndaFilter}
                    onChange={(e) => setNdaFilter(e.target.value)}
                  >
                    <option value="all">All NDA Status</option>
                    <option value="signed">NDA Signed</option>
                    <option value="pending">NDA Pending</option>
                  </select>
                </div>
              </div>

              {/* Buyers Table */}
              <div className="card">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredBuyers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Company
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registered
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredBuyers.map((buyer) => (
                          <tr key={buyer.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{buyer.company_name}</div>
                                {buyer.website && (
                                  <div className="text-sm text-gray-500">{buyer.website}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm text-gray-900">{buyer.contact_name}</div>
                                <div className="text-sm text-gray-500">{buyer.contact_email}</div>
                                {buyer.contact_phone && (
                                  <div className="text-sm text-gray-500">{buyer.contact_phone}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {buyer.city && buyer.state ? `${buyer.city}, ${buyer.state}` : 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(
                                buyer.status, 
                                buyer.nda_signed, 
                                buyer.nda_compliance_status,
                                buyer.current_nda_version,
                                buyer.nda_version_signed
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(buyer.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedBuyer(buyer)
                                    setShowDetails(true)
                                  }}
                                  className="text-indigo-600 hover:text-indigo-900 flex items-center space-x-1"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                  <span>Details</span>
                                </button>
                                
                                {buyer.status === 'pending' && buyer.nda_signed && (
                                  <button
                                    onClick={() => handleStatusUpdate(buyer.id, 'approved')}
                                    className="text-green-600 hover:text-green-900 flex items-center space-x-1"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    <span>Approve</span>
                                  </button>
                                )}
                                
                                {buyer.status === 'approved' && (
                                  <button
                                    onClick={() => handleStatusUpdate(buyer.id, 'suspended')}
                                    className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                    <span>Suspend</span>
                                  </button>
                                )}
                                
                                {buyer.status === 'suspended' && (
                                  <button
                                    onClick={() => handleStatusUpdate(buyer.id, 'approved')}
                                    className="text-green-600 hover:text-green-900 flex items-center space-x-1"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    <span>Reactivate</span>
                                  </button>
                                )}
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
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No buyers found</h3>
                    <p className="text-sm text-gray-500">
                      {searchQuery || statusFilter !== 'all' || ndaFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria.'
                        : 'No buyer registrations have been submitted yet.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Buyer Details Modal */}
        {showDetails && selectedBuyer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Buyer Details</h3>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBuyer.company_name}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Contact</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBuyer.contact_name}</p>
                    <p className="mt-1 text-sm text-gray-900">{selectedBuyer.contact_email}</p>
                    {selectedBuyer.contact_phone && (
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.contact_phone}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    {selectedBuyer.address_line1 && (
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.address_line1}</p>
                    )}
                    {selectedBuyer.address_line2 && (
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.address_line2}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedBuyer.city && selectedBuyer.state ? `${selectedBuyer.city}, ${selectedBuyer.state} ${selectedBuyer.zip_code || ''}` : 'N/A'}
                    </p>
                  </div>
                  
                  {selectedBuyer.website && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Website</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.website}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <div className="mt-1">
                      {getStatusBadge(
                        selectedBuyer.status, 
                        selectedBuyer.nda_signed, 
                        selectedBuyer.nda_compliance_status,
                        selectedBuyer.current_nda_version,
                        selectedBuyer.nda_version_signed
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">NDA Status</label>
                    <div className="mt-1">
                      {getStatusBadge(
                        selectedBuyer.status, 
                        selectedBuyer.nda_signed, 
                        selectedBuyer.nda_compliance_status,
                        selectedBuyer.current_nda_version,
                        selectedBuyer.nda_version_signed
                      )}
                    </div>
                  </div>
                  
                  {selectedBuyer.current_nda_version && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current NDA Version</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.current_nda_version}</p>
                    </div>
                  )}
                  
                  {selectedBuyer.nda_version_signed && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Signed NDA Version</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.nda_version_signed}</p>
                    </div>
                  )}
                  
                  {selectedBuyer.verification_notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.verification_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buyer Registration Modal */}
        {showRegistrationForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Register New Buyer</h3>
                <button
                  onClick={() => setShowRegistrationForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleRegistrationSubmit} className="space-y-4">
                {/* Company Information */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Company Information</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        id="company_name"
                        required
                        value={registrationForm.company_name}
                        onChange={(e) => handleFormChange('company_name', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                        Website
                      </label>
                      <input
                        type="url"
                        id="website"
                        value={registrationForm.website}
                        onChange={(e) => handleFormChange('website', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Contact Information</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        id="contact_name"
                        required
                        value={registrationForm.contact_name}
                        onChange={(e) => handleFormChange('contact_name', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">
                        Contact Email *
                      </label>
                      <input
                        type="email"
                        id="contact_email"
                        required
                        value={registrationForm.contact_email}
                        onChange={(e) => handleFormChange('contact_email', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700">
                        Contact Phone *
                      </label>
                      <input
                        type="tel"
                        id="contact_phone"
                        required
                        value={registrationForm.contact_phone}
                        onChange={(e) => handleFormChange('contact_phone', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Address Information</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="address_line1" className="block text-sm font-medium text-gray-700">
                        Address Line 1 *
                      </label>
                      <input
                        type="text"
                        id="address_line1"
                        required
                        value={registrationForm.address_line1}
                        onChange={(e) => handleFormChange('address_line1', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="address_line2" className="block text-sm font-medium text-gray-700">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        id="address_line2"
                        value={registrationForm.address_line2}
                        onChange={(e) => handleFormChange('address_line2', e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                          City *
                        </label>
                        <input
                          type="text"
                          id="city"
                          required
                          value={registrationForm.city}
                          onChange={(e) => handleFormChange('city', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                          State *
                        </label>
                        <input
                          type="text"
                          id="state"
                          required
                          value={registrationForm.state}
                          onChange={(e) => handleFormChange('state', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700">
                          ZIP Code *
                        </label>
                        <input
                          type="text"
                          id="zip_code"
                          required
                          value={registrationForm.zip_code}
                          onChange={(e) => handleFormChange('zip_code', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification Notes */}
                <div>
                  <label htmlFor="verification_notes" className="block text-sm font-medium text-gray-700">
                    Verification Notes
                  </label>
                  <textarea
                    id="verification_notes"
                    rows={3}
                    value={registrationForm.verification_notes}
                    onChange={(e) => handleFormChange('verification_notes', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Any notes about the buyer verification process..."
                  />
                </div>

                {registrationError && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <div className="mt-2 text-sm text-red-700">{registrationError}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRegistrationForm(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registrationLoading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {registrationLoading ? 'Registering...' : 'Register Buyer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
} 