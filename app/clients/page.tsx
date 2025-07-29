'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import AddClientModal from '@/components/AddClientModal'
import EditClientModal from '@/components/EditClientModal'
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon
} from '@heroicons/react/24/outline'

import { MasterClient } from '@/types/database'

type Client = MasterClient

export default function ClientsPage() {
  const { profile, isPlatformAdmin } = useAuth()
  const [clients, setClients] = useState<MasterClient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<MasterClient | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      } else {
        console.error('Error fetching clients:', response.status)
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleClientAdded = () => {
    fetchClients() // Refresh the clients list
  }

  const handleEditClient = (client: Client) => {
    setSelectedClient(client)
    setShowEditModal(true)
  }

  const handleClientUpdated = () => {
    fetchClients() // Refresh the clients list
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
                  <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
                  <p className="text-gray-600">Manage creditor clients and their portfolios</p>
                </div>
                {isPlatformAdmin && (
                  <button 
                    className="btn-primary flex items-center space-x-2"
                    onClick={() => setShowAddModal(true)}
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span>Add Client</span>
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
                      placeholder="Search clients..."
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
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Clients Table */}
              <div className="card">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredClients.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Client
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
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
                        {filteredClients.map((client) => (
                          <tr key={client.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{client.name}</div>
                                <div className="text-sm text-gray-500">{client.code}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm text-gray-900">{client.contact_name || 'N/A'}</div>
                                <div className="text-sm text-gray-500">{client.contact_email || 'N/A'}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {client.client_type?.replace('_', ' ') || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                client.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {client.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {isPlatformAdmin && (
                                <button
                                  onClick={() => handleEditClient(client)}
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
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No clients found</h3>
                    <p className="text-sm text-gray-500">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Get started by creating your first client.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Add Client Modal */}
        <AddClientModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onClientAdded={handleClientAdded}
        />

        {/* Edit Client Modal */}
        <EditClientModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedClient(null)
          }}
          client={selectedClient}
          onClientUpdated={handleClientUpdated}
        />
      </div>
    </ProtectedRoute>
  )
} 