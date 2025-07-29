'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { authenticatedFetch } from '@/lib/supabase'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: {
    id: string
    email: string
    full_name: string
    role: string
    agency_id: string | null
    status: string
  } | null
}

interface UserFormData {
  full_name: string
  role: string
  agency_id: string
  status: string
}

interface Agency {
  id: string
  name: string
  code: string
}

export default function EditUserModal({ isOpen, onClose, onUserUpdated, user }: EditUserModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    full_name: '',
    role: 'platform_user',
    agency_id: '',
    status: 'active'
  })
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        full_name: user.full_name || '',
        role: user.role,
        agency_id: user.agency_id || '',
        status: user.status
      })
      fetchAgencies()
    }
  }, [isOpen, user])

  const fetchAgencies = async () => {
    try {
      const response = await fetch('/api/agencies')
      if (response.ok) {
        const data = await response.json()
        setAgencies(data)
      }
    } catch (error) {
      console.error('Error fetching agencies:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const response = await authenticatedFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          role: formData.role,
          agency_id: formData.agency_id || null,
          status: formData.status
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
      setError('An error occurred while updating the user')
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
  }

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value
    setFormData(prev => ({
      ...prev,
      role,
      // Clear agency_id if role doesn't require it
      agency_id: role.startsWith('platform') ? '' : prev.agency_id
    }))
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="input-field w-full bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Full Name */}
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

          {/* Role and Agency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleRoleChange}
                required
                className="input-field w-full"
              >
                <option value="platform_admin">Platform Admin</option>
                <option value="platform_user">Platform User</option>
                <option value="agency_admin">Agency Admin</option>
                <option value="agency_user">Agency User</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agency
              </label>
              <select
                name="agency_id"
                value={formData.agency_id}
                onChange={handleInputChange}
                className="input-field w-full"
                disabled={formData.role.startsWith('platform')}
              >
                <option value="">Select Agency</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name} ({agency.code})
                  </option>
                ))}
              </select>
              {formData.role.startsWith('platform') && (
                <p className="text-xs text-gray-500 mt-1">
                  Platform users are not assigned to specific agencies
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              required
              className="input-field w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Status Descriptions */}
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Status Descriptions:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Active:</strong> User can log in and access the system</p>
              <p><strong>Inactive:</strong> User account is disabled but can be reactivated</p>
              <p><strong>Suspended:</strong> User account is temporarily suspended</p>
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