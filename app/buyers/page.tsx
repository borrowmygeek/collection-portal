'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import { 
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { MasterBuyer } from '@/types/sales'

export default function BuyersPage() {
  const { profile, isPlatformAdmin } = useAuth()
  const [buyers, setBuyers] = useState<MasterBuyer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBuyer, setSelectedBuyer] = useState<MasterBuyer | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    fetchBuyers()
  }, [])

  const fetchBuyers = async () => {
    try {
      const response = await fetch('/api/buyers')
      if (response.ok) {
        const data = await response.json()
        setBuyers(data.buyers || [])
      } else {
        throw new Error('Failed to fetch buyers')
      }
    } catch (error) {
      setError('Failed to load buyers')
      console.error('Error fetching buyers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (buyerId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/buyers/${buyerId}`, {
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
      setError('Failed to update buyer status')
      console.error('Error updating buyer status:', error)
    }
  }

  const getStatusBadge = (status: string, ndaSigned: boolean) => {
    if (!ndaSigned) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ClockIcon className="h-3 w-3 mr-1" />
          Pending NDA
        </span>
      )
    }

    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Approved
          </span>
        )
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Suspended
          </span>
        )
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
            <div className="container mx-auto px-6 py-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Buyer Management</h1>
                <p className="mt-2 text-gray-600">
                  Manage buyer registrations and NDA approvals
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <BuildingOfficeIcon className="h-6 w-6 text-gray-400" />
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
                      <CheckCircleIcon className="h-6 w-6 text-green-400" />
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
                      <ClockIcon className="h-6 w-6 text-yellow-400" />
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
                      <XCircleIcon className="h-6 w-6 text-red-400" />
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

              {/* Buyers List */}
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Buyer Registrations
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Review and manage buyer accounts
                  </p>
                </div>

                {loading ? (
                  <div className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading buyers...</p>
                  </div>
                ) : buyers.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No buyers found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No buyer registrations have been submitted yet.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {buyers.map((buyer) => (
                      <li key={buyer.id} className="px-4 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-lg font-medium text-gray-900 truncate">
                                  {buyer.company_name}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {buyer.contact_name} • {buyer.contact_email}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {buyer.city}, {buyer.state} {buyer.zip_code}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {getStatusBadge(buyer.status, buyer.nda_signed)}
                              </div>
                            </div>
                            
                            <div className="mt-2 text-sm text-gray-500">
                              <p>Registered: {formatDate(buyer.created_at)}</p>
                              {buyer.nda_signed_date && (
                                <p>NDA Signed: {formatDate(buyer.nda_signed_date)}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="ml-4 flex-shrink-0 flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedBuyer(buyer)
                                setShowDetails(true)
                              }}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              Details
                            </button>
                            
                            {buyer.status === 'pending' && buyer.nda_signed && (
                              <button
                                onClick={() => handleStatusUpdate(buyer.id, 'approved')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Approve
                              </button>
                            )}
                            
                            {buyer.status === 'approved' && (
                              <button
                                onClick={() => handleStatusUpdate(buyer.id, 'suspended')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                <XCircleIcon className="h-4 w-4 mr-1" />
                                Suspend
                              </button>
                            )}
                            
                            {buyer.status === 'suspended' && (
                              <button
                                onClick={() => handleStatusUpdate(buyer.id, 'approved')}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Reactivate
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <XCircleIcon className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                  </div>
                </div>
              )}
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
                    <p className="mt-1 text-sm text-gray-900">{selectedBuyer.contact_phone}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedBuyer.address_line1}</p>
                    {selectedBuyer.address_line2 && (
                      <p className="mt-1 text-sm text-gray-900">{selectedBuyer.address_line2}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedBuyer.city}, {selectedBuyer.state} {selectedBuyer.zip_code}
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
                      {getStatusBadge(selectedBuyer.status, selectedBuyer.nda_signed)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Registration Date</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedBuyer.created_at)}</p>
                  </div>
                  
                  {selectedBuyer.nda_signed_date && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">NDA Signed</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedBuyer.nda_signed_date)}</p>
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
      </div>
    </ProtectedRoute>
  )
} 