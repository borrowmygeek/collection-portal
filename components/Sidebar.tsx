'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  FolderIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowUpTrayIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { authenticatedFetch } from '@/lib/supabase'
import { toast } from 'react-toastify'

// Define all navigation items
const navigationItems = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Agencies', href: '/agencies', icon: BuildingOfficeIcon },
  { name: 'Clients', href: '/clients', icon: UsersIcon },
  { name: 'Buyers', href: '/buyers', icon: ShoppingCartIcon },
  { name: 'Sales', href: '/sales', icon: CurrencyDollarIcon },
  { name: 'Portfolios', href: '/portfolios', icon: FolderIcon },
  { name: 'Users', href: '/users', icon: UsersIcon },
  { name: 'Import', href: '/import', icon: ArrowUpTrayIcon },
  { name: 'Debtors', href: '/debtors', icon: UserGroupIcon },
  { name: 'Security', href: '/security', icon: ShieldCheckIcon },
]

// Role-based navigation permissions
const navigationPermissions = {
  'Dashboard': ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user', 'buyer'],
  'Agencies': ['platform_admin'],
  'Clients': ['platform_admin', 'agency_admin'],
  'Buyers': ['platform_admin'],
  'Sales': ['buyer'],
  'Portfolios': ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'],
  'Users': ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'],
  'Import': ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'],
  'Debtors': ['platform_admin', 'agency_admin', 'agency_user', 'client_admin', 'client_user'],
  'Security': ['platform_admin'],
}

export function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [roles, setRoles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { user, profile, signOut, refreshUser } = useAuth()
  const pathname = usePathname()

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
        setRoles(data.roles || [])
      }
    } catch (error) {
      console.error('Failed to load roles:', error)
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

  const getNavigation = () => {
    if (!user || !profile) return []
    
    const userRole = profile.activeRole.roleType
    
    // Platform admin sees everything
    if (userRole === 'platform_admin') {
      return navigationItems
    }
    
    // Filter navigation items based on user's role
    return navigationItems.filter(item => {
      const allowedRoles = navigationPermissions[item.name as keyof typeof navigationPermissions]
      return allowedRoles && allowedRoles.includes(userRole)
    })
  }

  const currentNavigation = getNavigation()

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <>
      <div>
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                      <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </button>
                    </div>
                  </Transition.Child>
                  {/* Sidebar component for mobile */}
                  <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
                    <div className="flex h-16 shrink-0 items-center">
                      <img
                        className="h-8 w-auto"
                        src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
                        alt="Your Company"
                      />
                    </div>
                    <nav className="flex flex-1 flex-col">
                      <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                          <ul role="list" className="-mx-2 space-y-1">
                            {currentNavigation.map((item) => (
                              <li key={item.name}>
                                <Link
                                  href={item.href}
                                  className={`
                                    group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                                    ${pathname === item.href
                                      ? 'bg-gray-50 text-indigo-600'
                                      : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                    }
                                  `}
                                  onClick={() => setSidebarOpen(false)}
                                >
                                  <item.icon
                                    className={`h-6 w-6 shrink-0 ${
                                      pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </li>
                        {/* User profile section for mobile */}
                        {user && (
                          <li className="mt-auto">
                            <div className="border-t border-gray-200 pt-4">
                              <div className="flex items-center gap-x-3 px-2 py-2">
                                <div className="flex-shrink-0">
                                  <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                                    <span className="text-sm font-medium text-white">
                                      {user.email?.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                                  <p className="text-xs text-gray-500 capitalize">{profile?.activeRole?.roleType?.replace('_', ' ') || 'Unknown Role'}</p>
                                </div>
                              </div>
                              
                              {/* Role Switcher for Mobile - Simple HTML Select */}
                              {roles.length > 1 && (
                                <div className="px-2 py-2">
                                  <label htmlFor="mobile-role-select" className="block text-xs font-medium text-gray-700 mb-1">
                                    Switch Role
                                  </label>
                                  <select
                                    id="mobile-role-select"
                                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={profile?.activeRole?.roleId || ''}
                                    onChange={(e) => switchRole(e.target.value)}
                                    disabled={isLoading}
                                  >
                                    {roles.map((role) => (
                                      <option key={role.id} value={role.id}>
                                        {role.organizationName} - {role.roleType?.replace('_', ' ') || 'Unknown Role'}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              
                              <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-x-3 px-2 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                              >
                                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                Sign out
                              </button>
                            </div>
                          </li>
                        )}
                      </ul>
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <img
                className="h-8 w-auto"
                src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
                alt="Your Company"
              />
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {currentNavigation.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`
                            group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                            ${pathname === item.href
                              ? 'bg-gray-50 text-indigo-600'
                              : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                            }
                          `}
                        >
                          <item.icon
                            className={`h-6 w-6 shrink-0 ${
                              pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'
                            }`}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
                {/* User profile section for desktop */}
                {user && (
                  <li className="mt-auto">
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center gap-x-3 px-2 py-2">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {user.email?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                          <p className="text-xs text-gray-500 capitalize">{profile?.activeRole?.roleType?.replace('_', ' ') || 'Unknown Role'}</p>
                        </div>
                      </div>
                      
                      {/* Role Switcher for Desktop - Simple HTML Select */}
                      {roles.length > 1 && (
                        <div className="px-2 py-2">
                          <label htmlFor="desktop-role-select" className="block text-xs font-medium text-gray-700 mb-1">
                            Switch Role
                          </label>
                          <select
                            id="desktop-role-select"
                            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            value={profile?.activeRole?.roleId || ''}
                            onChange={(e) => switchRole(e.target.value)}
                            disabled={isLoading}
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.organizationName} - {role.roleType?.replace('_', ' ') || 'Unknown Role'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-x-3 px-2 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                      >
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                        Sign out
                      </button>
                    </div>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </div>

        <div className="lg:pl-72">
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Separator */}
            <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1"></div>
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                {/* Profile dropdown for mobile header */}
                <div className="relative lg:hidden">
                  <div className="flex items-center gap-x-4">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{user?.email}</span>
                      <span className="text-gray-500 ml-2">({profile?.activeRole?.roleType?.replace('_', ' ') || 'Unknown Role'})</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar