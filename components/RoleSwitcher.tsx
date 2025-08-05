'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import { 
  ChevronDownIcon, 
  UserIcon, 
  BuildingOfficeIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  CogIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-toastify'

interface Role {
  id: string
  roleType: 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer'
  organizationType: 'platform' | 'agency' | 'client' | 'buyer'
  organizationId?: string
  organizationName: string
  isPrimary: boolean
  isActive: boolean
  permissions: Record<string, any>
}

interface RoleSwitcherProps {
  className?: string
  showCurrentRole?: boolean
}

export default function RoleSwitcher({ className = '', showCurrentRole = true }: RoleSwitcherProps) {
  const { user, refreshUser } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [currentRole, setCurrentRole] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Load roles on component mount
  useEffect(() => {
    if (user) {
      loadRoles()
    }
  }, [user])

  const loadRoles = async () => {
    try {
      const response = await authenticatedFetch('/api/auth/roles')
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 RoleSwitcher: Received roles data:', data)
        
        // Validate and set roles
        if (data.roles && Array.isArray(data.roles)) {
          setRoles(data.roles)
        } else {
          console.warn('⚠️ RoleSwitcher: Invalid roles data received:', data.roles)
          setRoles([])
        }
        
        // Validate and set current role
        if (data.currentRole && typeof data.currentRole === 'object') {
          setCurrentRole(data.currentRole)
        } else {
          console.warn('⚠️ RoleSwitcher: Invalid currentRole data received:', data.currentRole)
          setCurrentRole(null)
        }
      } else {
        console.error('❌ RoleSwitcher: Failed to load roles, status:', response.status)
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ RoleSwitcher: Error data:', errorData)
      }
    } catch (error) {
      console.error('❌ RoleSwitcher: Failed to load roles:', error)
    }
  }

  const switchRole = async (roleId: string) => {
    setIsLoading(true)
    try {
      const response = await authenticatedFetch('/api/auth/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roleId })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Store the session token in localStorage
        localStorage.setItem('roleSessionToken', data.session.sessionToken)
        
        // Refresh user data
        await refreshUser()
        
        // Reload roles
        await loadRoles()
        
        toast.success(`Switched to ${data.newRole.organizationName}`)
        setIsOpen(false)
      } else {
        const error = await response.json()
        
        // Handle NDA compliance errors
        if (error.requires_nda) {
          toast.error(
            <div>
              <div className="font-semibold">NDA Compliance Required</div>
              <div className="text-sm mt-1">
                {error.compliance.message}
              </div>
              <div className="text-xs mt-2 text-gray-600">
                Current version: {error.compliance.current_version} | 
                Your version: {error.compliance.signed_version || 'None'}
              </div>
            </div>,
            { autoClose: 8000 }
          )
        } else {
          toast.error(error.error || 'Failed to switch role')
        }
      }
    } catch (error) {
      console.error('Failed to switch role:', error)
      toast.error('Failed to switch role')
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleIcon = (roleType: string, organizationType: string) => {
    switch (organizationType) {
      case 'platform':
        return <CogIcon className="h-4 w-4" />
      case 'agency':
        return <BuildingOfficeIcon className="h-4 w-4" />
      case 'client':
        return <UserGroupIcon className="h-4 w-4" />
      case 'buyer':
        return <ShoppingCartIcon className="h-4 w-4" />
      default:
        return <UserIcon className="h-4 w-4" />
    }
  }

  const getRoleBadgeColor = (roleType: string) => {
    switch (roleType) {
      case 'platform_admin':
        return 'bg-red-100 text-red-800'
      case 'agency_admin':
        return 'bg-blue-100 text-blue-800'
      case 'client_admin':
        return 'bg-green-100 text-green-800'
      case 'buyer':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatRoleName = (roleType: string) => {
    if (!roleType || typeof roleType !== 'string') return 'Unknown Role'
    return roleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (!user || roles.length <= 1) {
    return null
  }

  const currentRoleData = currentRole || roles.find(role => role.id === currentRole?.roleId)

  return (
    <div className={className}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 min-w-0"
            disabled={isLoading}
          >
            {currentRoleData && getRoleIcon(currentRoleData.roleType || '', currentRoleData.organizationType || '')}
            <div className="flex flex-col items-start min-w-0">
              {showCurrentRole && currentRoleData && (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium truncate">
                    {currentRoleData.organizationName || 'Unknown Organization'}
                  </span>
                  <Badge 
                    variant="default" 
                    className={`text-xs ${getRoleBadgeColor(currentRoleData.roleType || '')}`}
                  >
                    {formatRoleName(currentRoleData.roleType || '')}
                  </Badge>
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {roles.length} role{roles.length !== 1 ? 's' : ''} available
              </span>
            </div>
            <ChevronDownIcon className="h-4 w-4 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {roles.map((role) => (
            <DropdownMenuItem
              key={role.id}
              onClick={() => switchRole(role.id)}
              disabled={isLoading || role.id === currentRole?.roleId}
              className="flex items-center gap-3 p-3 cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getRoleIcon(role.roleType || '', role.organizationType || '')}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium truncate">
                      {role.organizationName || 'Unknown Organization'}
                    </span>
                    {role.isPrimary && (
                      <Badge variant="outline" className="text-xs">
                        Primary
                      </Badge>
                    )}
                    {role.roleType === 'buyer' && (
                      <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500" title="NDA compliance required" />
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatRoleName(role.roleType || '')}
                  </span>
                </div>
              </div>
              
              {role.id === currentRole?.roleId && (
                <Badge variant="default" className="text-xs">
                  Active
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              localStorage.removeItem('roleSessionToken')
              refreshUser()
              toast.success('Switched to primary role')
            }}
            className="text-center text-sm text-muted-foreground"
          >
            Use Primary Role
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 