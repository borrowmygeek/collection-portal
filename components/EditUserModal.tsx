'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { authenticatedFetch } from '@/lib/supabase'

interface UserRole {
  id?: string
  role_type: string
  organization_type: string
  organization_id: string | null
  is_primary: boolean
  permissions: Record<string, any>
  created_at?: string
}

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: {
    id: string
    email: string
    full_name: string
    role: string // For backward compatibility
    primary_role: {
      id: string
      role_type: string
      organization_type: string
      organization_id: string | null
      permissions: Record<string, any>
    } | null
    roles: UserRole[]
    agency_id: string | null
    status: string
  } | null
}

interface UserFormData {
  full_name: string
  status: string
  roles: UserRole[]
}

interface Agency {
  id: string
  name: string
  code: string
}

interface Client {
  id: string
  name: string
  code: string
}

interface Buyer {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
}

// Helper function to determine organization type from role type
const getOrganizationTypeFromRoleType = (roleType: string): string => {
  if (roleType.startsWith('platform_')) return 'platform'
  if (roleType.startsWith('agency_')) return 'agency'
  if (roleType.startsWith('client_')) return 'client'
  if (roleType === 'buyer') return 'buyer'
  return 'platform'
}

export default function EditUserModal({ isOpen, onClose, onUserUpdated, user }: EditUserModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    full_name: '',
    status: 'active',
    roles: []
  })
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        full_name: user.full_name || '',
        status: user.status,
        roles: user.roles ? [...user.roles] : []
      })
      fetchOrganizations()
    }
  }, [isOpen, user])

  const fetchOrganizations = async () => {
    try {
      // Fetch agencies
      const agenciesResponse = await authenticatedFetch('/api/agencies')
      if (agenciesResponse.ok) {
        const agenciesData = await agenciesResponse.json()
        setAgencies(agenciesData)
      }

      // Fetch clients
      const clientsResponse = await authenticatedFetch('/api/clients')
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json()
        setClients(clientsData)
      }

      // Fetch buyers
      const buyersResponse = await authenticatedFetch('/api/buyers')
      if (buyersResponse.ok) {
        const buyersData = await buyersResponse.json()
        setBuyers(buyersData.buyers || [])
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    // Validate at least one primary role
    const primaryRoles = formData.roles.filter(role => role.is_primary)
    if (primaryRoles.length === 0) {
      setError('At least one role must be set as primary')
      setLoading(false)
      return
    }

    // Validate organization selection for non-platform roles
    const invalidRoles = formData.roles.filter(role => {
      if (role.organization_type === 'platform') return false
      if (role.organization_type === 'buyer' && !role.organization_id) return true
      if (role.organization_type === 'agency' && !role.organization_id) return true
      if (role.organization_type === 'client' && !role.organization_id) return true
      return false
    })

    if (invalidRoles.length > 0) {
      setError('Please select an organization for all non-platform roles')
      setLoading(false)
      return
    }

    try {
      const response = await authenticatedFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          status: formData.status,
          roles: formData.roles
        }),
      })

      if (response.ok) {
        onUserUpdated()
        onClose()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      setError('Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  const addRole = () => {
    setFormData(prev => ({
      ...prev,
      roles: [...prev.roles, {
        role_type: 'platform_user',
        organization_type: 'platform',
        organization_id: null,
        is_primary: false,
        permissions: {}
      }]
    }))
    setError('')
  }

  const removeRole = (index: number) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index)
    }))
    setError('')
  }

  const updateRole = (index: number, field: keyof UserRole, value: any) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.map((role, i) => {
        if (i === index) {
          const updatedRole = { ...role, [field]: value }
          
          // If role type changed, update organization type and reset organization_id
          if (field === 'role_type') {
            // For buyer roles, don't automatically set organization type
            // Let user choose from any organization type
            if (value === 'buyer') {
              updatedRole.organization_type = 'buyer' // Keep as buyer but allow any org type
            } else {
              updatedRole.organization_type = getOrganizationTypeFromRoleType(value)
            }
            updatedRole.organization_id = ''
          }
          
          // If setting this role as primary, unset others
          if (field === 'is_primary' && value === true) {
            prev.roles.forEach((otherRole, otherIndex) => {
              if (otherIndex !== index) {
                otherRole.is_primary = false
              }
            })
          }
          
          return updatedRole
        }
        
        return role
      })
    }))
    setError('')
  }

  const getOrganizationOptions = (organizationType: string) => {
    switch (organizationType) {
      case 'agency':
        return agencies.map(agency => (
          <option key={agency.id} value={agency.id}>
            {agency.name} ({agency.code})
          </option>
        ))
      case 'client':
        return clients.map(client => (
          <option key={client.id} value={client.id}>
            {client.name} ({client.code})
          </option>
        ))
      case 'buyer':
        // For buyer roles, show all three organization types
        return [
          // Agencies
          ...agencies.map(agency => (
            <option key={`agency-${agency.id}`} value={agency.id}>
              Agency: {agency.name} ({agency.code})
            </option>
          )),
          // Clients
          ...clients.map(client => (
            <option key={`client-${client.id}`} value={client.id}>
              Client: {client.name} ({client.code})
            </option>
          )),
          // Buyers
          ...buyers.map(buyer => (
            <option key={`buyer-${buyer.id}`} value={buyer.id}>
              Buyer: {buyer.company_name} ({buyer.contact_name})
            </option>
          ))
        ]
      default:
        return []
    }
  }

  const getOrganizationLabel = (organizationType: string) => {
    switch (organizationType) {
      case 'platform':
        return 'Platform (No organization needed)'
      case 'agency':
        return 'Agency'
      case 'client':
        return 'Client'
      case 'buyer':
        return 'Organization (Agency/Client/Buyer)'
      default:
        return 'Organization'
    }
  }

  const isOrganizationRequired = (organizationType: string) => {
    return organizationType !== 'platform'
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit User</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="input-field w-full bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                required
                className="input-field w-full"
                placeholder="Enter full name"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="input-field w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Roles Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">User Roles</h4>
              <button
                type="button"
                onClick={addRole}
                className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-900"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add Role</span>
              </button>
            </div>

            {formData.roles.map((role, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-medium text-gray-700">Role {index + 1}</h5>
                  {formData.roles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRole(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role Type *
                    </label>
                    <select
                      value={role.role_type}
                      onChange={(e) => updateRole(index, 'role_type', e.target.value)}
                      required
                      className="input-field w-full"
                    >
                      <option value="platform_admin">Platform Admin</option>
                      <option value="platform_user">Platform User</option>
                      <option value="agency_admin">Agency Admin</option>
                      <option value="agency_user">Agency User</option>
                      <option value="client_admin">Client Admin</option>
                      <option value="client_user">Client User</option>
                      <option value="buyer">Buyer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getOrganizationLabel(role.organization_type)}
                      {isOrganizationRequired(role.organization_type) && <span className="text-red-500"> *</span>}
                    </label>
                    <select
                      value={role.organization_id || ''}
                      onChange={(e) => updateRole(index, 'organization_id', e.target.value || null)}
                      className="input-field w-full"
                      disabled={role.organization_type === 'platform'}
                      required={isOrganizationRequired(role.organization_type)}
                    >
                      <option value="">Select Organization</option>
                      {getOrganizationOptions(role.organization_type)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`primary-${index}`}
                    checked={role.is_primary}
                    onChange={(e) => updateRole(index, 'is_primary', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`primary-${index}`} className="ml-2 block text-sm text-gray-900">
                    Set as primary role
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Role Descriptions */}
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Role Descriptions:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Platform Admin:</strong> Full platform access, can manage all organizations and users</p>
              <p><strong>Platform User:</strong> Read-only platform access, can view analytics and reports</p>
              <p><strong>Agency Admin:</strong> Full access to assigned agency, can manage agency users</p>
              <p><strong>Agency User:</strong> Limited access to assigned agency data and operations</p>
              <p><strong>Client Admin:</strong> Full access to assigned client, can manage client users</p>
              <p><strong>Client User:</strong> Limited access to assigned client data and operations</p>
              <p><strong>Buyer:</strong> Access to purchase portfolios and manage purchases for assigned buyer organization</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 