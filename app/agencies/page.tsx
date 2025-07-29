'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MasterAgency } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import AddAgencyModal from '@/components/AddAgencyModal'
import EditAgencyModal from '@/components/EditAgencyModal'

export default function AgenciesPage() {
  const { isPlatformAdmin } = useAuth()
  const [agencies, setAgencies] = useState<MasterAgency[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedAgency, setSelectedAgency] = useState<MasterAgency | null>(null)

  useEffect(() => {
    fetchAgencies()
  }, [])

  const fetchAgencies = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('master_agencies')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching agencies:', error)
        return
      }

      setAgencies(data as unknown as MasterAgency[] || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAgencies = agencies.filter(agency => {
    const matchesSearch = agency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agency.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agency.contact_email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || agency.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'suspended':
        return 'text-red-600 bg-red-100'
      case 'inactive':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-yellow-600 bg-yellow-100'
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'text-purple-600 bg-purple-100'
      case 'professional':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const handleEditAgency = (agency: MasterAgency) => {
    setSelectedAgency(agency)
    setShowEditModal(true)
  }

  const handleAgencyUpdated = () => {
    fetchAgencies() // Refresh the agencies list
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
                  <h1 className="text-2xl font-bold text-gray-900">Agencies</h1>
                  <p className="text-gray-600">Manage collection agencies and their subscriptions</p>
                </div>
                {isPlatformAdmin && (
                  <button 
                    className="btn-primary flex items-center space-x-2"
                    onClick={() => setShowAddModal(true)}
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span>Add Agency</span>
                  </button>
                )}
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
                      placeholder="Search agencies..."
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
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                    <option value="provisioning">Provisioning</option>
                  </select>
                </div>
              </div>

              {/* Agencies Table */}
              <div className="card">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Agency</th>
                          <th className="table-header">Contact</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Tier</th>
                          <th className="table-header">Monthly Fee</th>
                          <th className="table-header">Created</th>
                          <th className="table-header">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAgencies.map((agency) => (
                          <tr key={agency.id} className="hover:bg-gray-50">
                            <td className="table-cell">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {agency.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {agency.code}
                                </div>
                              </div>
                            </td>
                            <td className="table-cell">
                              <div>
                                <div className="text-sm text-gray-900">
                                  {agency.contact_name || 'N/A'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {agency.contact_email}
                                </div>
                              </div>
                            </td>

                            <td className="table-cell">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agency.status)}`}>
                                {agency.status}
                              </span>
                            </td>
                            <td className="table-cell">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(agency.subscription_tier)}`}>
                                {agency.subscription_tier}
                              </span>
                            </td>
                            <td className="table-cell">
                              <div className="text-sm text-gray-900">
                                ${agency.base_monthly_fee}
                              </div>
                              <div className="text-sm text-gray-500">
                                {agency.billing_cycle}
                              </div>
                            </td>
                            <td className="table-cell text-sm text-gray-500">
                              {new Date(agency.created_at).toLocaleDateString()}
                            </td>
                            <td className="table-cell">
                              {isPlatformAdmin && (
                                <button
                                  onClick={() => handleEditAgency(agency)}
                                  className="text-indigo-600 hover:text-indigo-900 flex items-center space-x-1"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredAgencies.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2">No agencies found</h3>
                        <p className="text-sm text-gray-500">
                          {searchQuery || statusFilter !== 'all'
                            ? 'Try adjusting your search or filter criteria.'
                            : 'Get started by creating your first agency.'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
        
        <AddAgencyModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchAgencies}
        />
        
        <EditAgencyModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedAgency(null)
          }}
          agency={selectedAgency as any}
          onAgencyUpdated={handleAgencyUpdated}
        />
      </div>
    </ProtectedRoute>
  )
} 