'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'
import AddUserModal from '@/components/AddUserModal'
import EditUserModal from '@/components/EditUserModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  UserCircleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface UserRole {
  id: string
  role_type: string
  organization_type: string
  organization_id: string | null
  is_primary: boolean
  permissions: Record<string, any>
  created_at: string
}

interface PrimaryRole {
  id: string
  role_type: string
  organization_type: string
  organization_id: string | null
  permissions: Record<string, any>
}

interface User {
  id: string
  auth_user_id: string
  email: string
  full_name: string
  role: string // For backward compatibility
  primary_role: PrimaryRole | null
  roles: UserRole[]
  agency_id: string | null
  status: string
  last_login_at: string | null
  created_at: string
  agency?: {
    name: string
    code: string
  }
}

export default function UsersPage() {
  const { profile, isPlatformAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ user: User; newStatus: string } | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        console.error('Error fetching users:', response.status)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.primary_role?.role_type === roleFilter || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const handleUserAdded = () => {
    fetchUsers() // Refresh the users list
  }

  const handleUserUpdated = () => {
    fetchUsers() // Refresh the users list
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setShowEditModal(true)
  }

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    setPendingStatusChange({ user, newStatus })
    setIsConfirmOpen(true)
  }

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusChange) return
    
    try {
      const response = await authenticatedFetch(`/api/users/${pendingStatusChange.user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: pendingStatusChange.newStatus
        })
      })

      if (response.ok) {
        fetchUsers() // Refresh the users list
      } else {
        console.error('Error updating user status')
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'platform_admin':
        return 'bg-purple-100 text-purple-800'
      case 'platform_user':
        return 'bg-blue-100 text-blue-800'
      case 'agency_admin':
        return 'bg-green-100 text-green-800'
      case 'agency_user':
        return 'bg-yellow-100 text-yellow-800'
      case 'client_admin':
        return 'bg-indigo-100 text-indigo-800'
      case 'client_user':
        return 'bg-pink-100 text-pink-800'
      case 'buyer':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-red-100 text-red-800'
      case 'suspended':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatRoleName = (roleType: string) => {
    if (!roleType || typeof roleType !== 'string') return 'Unknown Role'
    return roleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const renderUserRoles = (user: User) => {
    if (!user.roles || user.roles.length === 0) {
      return (
        <span className="text-sm text-gray-500">No roles assigned</span>
      )
    }

    return (
      <div className="flex flex-wrap gap-1">
        {user.roles.map((role, index) => (
          <div key={role.id} className="flex items-center gap-1">
            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(role.role_type)}`}>
                             {formatRoleName(role.role_type)}
               {role.is_primary && (
                 <span className="ml-1 text-xs">★</span>
               )}
            </span>
            {index < user.roles.length - 1 && <span className="text-gray-300">•</span>}
          </div>
        ))}
      </div>
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
                  <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                  <p className="text-gray-600">Manage platform users and their roles</p>
                </div>
                {isPlatformAdmin && (
                  <button 
                    className="btn-primary flex items-center space-x-2"
                    onClick={() => setShowAddModal(true)}
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span>Add User</span>
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
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <FunnelIcon className="h-5 w-5 text-gray-400" />
                  <select
                    className="input-field"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    <option value="platform_admin">Platform Admin</option>
                    <option value="platform_user">Platform User</option>
                    <option value="agency_admin">Agency Admin</option>
                    <option value="agency_user">Agency User</option>
                    <option value="client_admin">Client Admin</option>
                    <option value="client_user">Client User</option>
                    <option value="buyer">Buyer</option>
                  </select>
                  <select
                    className="input-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="card">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  </div>
                ) : filteredUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Roles
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Primary Organization
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Login
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
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <UserCircleIcon className="h-10 w-10 text-gray-400" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {renderUserRoles(user)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.primary_role?.organization_type === 'platform' ? 'Platform' : 
                               user.primary_role?.organization_type === 'agency' ? (user.agency?.name || 'Agency') :
                               user.primary_role?.organization_type === 'client' ? 'Client' :
                               user.primary_role?.organization_type === 'buyer' ? 'Buyer' : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.status)}`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.last_login_at 
                                ? new Date(user.last_login_at).toLocaleDateString()
                                : 'Never'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {isPlatformAdmin && (
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={() => handleEditUser(user)}
                                    className="text-indigo-600 hover:text-indigo-900 flex items-center space-x-1"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleToggleStatus(user)}
                                    className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${
                                      user.status === 'active'
                                        ? 'text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100'
                                        : 'text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100'
                                    }`}
                                    title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                                  >
                                    {user.status === 'active' ? (
                                      <>
                                        <XMarkIcon className="h-3 w-3" />
                                        <span>Deactivate</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckIcon className="h-3 w-3" />
                                        <span>Activate</span>
                                      </>
                                    )}
                                  </button>
                                </div>
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
                      <UserCircleIcon className="mx-auto h-12 w-12" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-sm text-gray-500">
                      {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Get started by creating your first user.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Add User Modal */}
        <AddUserModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onUserAdded={handleUserAdded}
        />

        {/* Edit User Modal */}
        <EditUserModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedUser(null)
          }}
          onUserUpdated={handleUserUpdated}
          user={selectedUser}
        />

        {/* Confirm Dialog for Status Change */}
        <ConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmStatusChange}
          title="Confirm Status Change"
          message={`Are you sure you want to ${pendingStatusChange?.newStatus === 'active' ? 'activate' : 'deactivate'} this user?`}
          confirmText={`${pendingStatusChange?.newStatus === 'active' ? 'Activate' : 'Deactivate'}`}
          cancelText="Cancel"
        />
      </div>
    </ProtectedRoute>
  )
} 