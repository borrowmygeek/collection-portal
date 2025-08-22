'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

// Version identifier to help with cache busting and debugging

interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  full_name: string
  status: 'active' | 'inactive' | 'suspended'
  // Current active role information
  activeRole: {
    roleId: string
    roleType: 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer'
    organizationType: 'platform' | 'agency' | 'client' | 'buyer'
    organizationId?: string
    organizationName: string
    permissions: Record<string, any>
  }
  // All available roles for the user
  availableRoles: Array<{
    id: string
    roleType: 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer'
    organizationType: 'platform' | 'agency' | 'client' | 'buyer'
    organizationId?: string
    organizationName: string
    permissions: Record<string, any>
  }>
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  // Computed boolean properties for better performance
  isPlatformAdmin: boolean
  isAgencyAdmin: boolean
  isClientAdmin: boolean
  // Auth functions
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Helper function to generate organization names
  const getOrganizationName = (organizationType: string, organizationId: string | null): string => {
    if (!organizationId) return 'Platform'
    
    switch (organizationType) {
      case 'agency':
        return `Agency ${organizationId}`
      case 'client':
        return `Client ${organizationId}`
      case 'buyer':
        return 'Buyer'
      default:
        return 'Platform'
    }
  }

  // Simple, clean profile fetch function with timeout and retry
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!userId) {
      console.error('❌ [AUTH] No user ID provided for profile fetch')
      return null
    }

    console.log('🔍 [AUTH] Starting profile fetch for user:', userId, '(attempt 1/3)')
    
    try {
      // Get supabase client
      const supabase = getSupabase()
      
      // Create a timeout promise that will definitely reject
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.log('⏰ [AUTH] Profile fetch timeout triggered after 5 seconds')
          reject(new Error('Profile fetch timeout after 5 seconds'))
        }, 5000)
      })

      // Use the new optimized function for fast profile fetch
      const profilePromise = supabase.rpc('get_user_profile_fast', {
        auth_user_id: userId
      })

      console.log('🔍 [AUTH] Racing profile fetch against 5-second timeout...')

      // Race between timeout and profile fetch
      const result = await Promise.race([profilePromise, timeoutPromise])
      
      // If we get here, the profile fetch succeeded (timeout would have rejected)
      const { data, error } = result

      if (error) {
        console.error('❌ [AUTH] Fast profile fetch error:', error)
        return null
      }

      if (!data) {
        console.error('❌ [AUTH] No data returned from fast profile fetch')
        return null
      }

      // Type the RPC response
      const rpcData = data as {
        profile: {
          id: string
          email: string
          auth_user_id: string
          full_name: string
          status: string
        }
        roles: Array<{
          id: string
          role_type: string
          organization_type: string
          organization_id: string
          is_active: boolean
          is_primary: boolean
          permissions: any
        }>
        primary_role: {
          role_id: string
          role_type: string
          organization_type: string
          organization_id: string
          permissions: any
        }
      }

      console.log('✅ [AUTH] Fast profile fetch successful:', {
        hasProfile: !!rpcData.profile,
        hasRoles: !!rpcData.roles,
        rolesCount: Array.isArray(rpcData.roles) ? rpcData.roles.length : 0
      })

      // Transform the data to match our UserProfile interface
      const profileData = rpcData.profile
      const userRoles = rpcData.roles || []
      const primaryRole = rpcData.primary_role

      if (!profileData || !primaryRole) {
        console.error('❌ [AUTH] Missing profile or primary role data')
        return null
      }

      // Transform roles to match our interface
      const availableRoles = userRoles.map((role: any) => ({
        id: role.id,
        roleType: role.role_type,
        organizationType: role.organization_type,
        organizationId: role.organization_id,
        organizationName: getOrganizationName(role.organization_type, role.organization_id),
        permissions: role.permissions || {}
      }))

      // Construct the final UserProfile object
      const userProfile: UserProfile = {
        id: profileData.id,
        auth_user_id: profileData.auth_user_id,
        email: profileData.email,
        full_name: profileData.full_name,
        status: profileData.status as 'active' | 'inactive' | 'suspended',
        activeRole: {
          roleId: primaryRole.role_id,
          roleType: primaryRole.role_type as 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer',
          organizationType: primaryRole.organization_type as 'platform' | 'agency' | 'client' | 'buyer',
          organizationId: primaryRole.organization_id as string,
          organizationName: getOrganizationName(primaryRole.organization_type, primaryRole.organization_id),
          permissions: primaryRole.permissions || {}
        },
        availableRoles
      }

      console.log('✅ [AUTH] User profile constructed successfully:', {
        id: userProfile.id,
        email: userProfile.email,
        activeRole: userProfile.activeRole.roleType,
        availableRolesCount: userProfile.availableRoles.length
      })

      return userProfile

    } catch (error) {
      console.error('❌ [AUTH] Fast profile fetch exception:', error)
      
      // If it's a timeout, try the old method as fallback
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('⏰ [AUTH] Fast profile fetch timed out, trying fallback method...')
        return await fetchUserProfileFallback(userId)
      }
      
      return null
    }
  }, [])

  // Fallback profile fetch method using the old approach
  const fetchUserProfileFallback = async (userId: string): Promise<UserProfile | null> => {
    console.log('🔄 [AUTH] Using fallback profile fetch method...')
    
    try {
      // Add timeout to fallback method as well
      const fallbackTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.log('⏰ [AUTH] Fallback method timeout triggered after 10 seconds')
          reject(new Error('Fallback method timeout after 10 seconds'))
        }, 10000)
      })

      const fallbackPromise = (async () => {
        console.log('🔍 [AUTH] Fallback: Getting basic profile data...')
        const supabase = getSupabase()
        
        // Get basic profile data
        const { data: profileData, error: profileError } = await supabase
          .from('platform_users')
          .select('id, email, auth_user_id, full_name, status')
          .eq('auth_user_id', userId)
          .single()

        console.log('🔍 [AUTH] Fallback: Profile query completed:', {
          hasData: !!profileData,
          hasError: !!profileError,
          errorMessage: profileError?.message
        })

        if (profileError || !profileData) {
          console.error('❌ [AUTH] Fallback profile fetch failed:', profileError)
          return null
        }

        console.log('✅ [AUTH] Fallback: Basic profile data fetched:', {
          id: profileData.id,
          email: profileData.email
        })

        console.log('🔍 [AUTH] Fallback: Getting user roles...')
        // Get user roles
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('id, role_type, organization_type, organization_id, is_active, is_primary, permissions')
          .eq('user_id', profileData.id as string)
          .eq('is_active', true)

        console.log('🔍 [AUTH] Fallback: Roles query completed:', {
          hasData: !!userRoles,
          hasError: !!rolesError,
          errorMessage: rolesError?.message,
          rolesCount: userRoles?.length || 0
        })

        if (rolesError) {
          console.error('❌ [AUTH] Fallback roles fetch failed:', rolesError)
          return null
        }

        if (!userRoles || userRoles.length === 0) {
          console.error('❌ [AUTH] No active roles found for user')
          return null
        }

        console.log('✅ [AUTH] Fallback: User roles fetched successfully')

        // Find the primary role
        const primaryRole = userRoles.find((role: any) => role.is_primary) || userRoles[0]

        console.log('🔍 [AUTH] Fallback: Primary role identified:', {
          roleId: primaryRole.id,
          roleType: primaryRole.role_type,
          isPrimary: primaryRole.is_primary
        })

        // Transform roles to match our interface
        const availableRoles = userRoles.map((role: any) => ({
          id: role.id as string,
          roleType: role.role_type as 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer',
          organizationType: role.organization_type as 'platform' | 'agency' | 'client' | 'buyer',
          organizationId: role.organization_id as string,
          organizationName: getOrganizationName(role.organization_type as 'platform' | 'agency' | 'client' | 'buyer', role.organization_id as string),
          permissions: role.permissions || {}
        }))

        console.log('✅ [AUTH] Fallback: Roles transformed successfully')

        // Construct the final UserProfile object
        const userProfile: UserProfile = {
          id: profileData.id as string,
          auth_user_id: profileData.auth_user_id as string,
          email: profileData.email as string,
          full_name: profileData.full_name as string,
          status: profileData.status as 'active' | 'inactive' | 'suspended',
          activeRole: {
            roleId: primaryRole.id as string,
            roleType: primaryRole.role_type as 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer',
            organizationType: primaryRole.organization_type as 'platform' | 'agency' | 'client' | 'buyer',
            organizationId: primaryRole.organization_id as string,
            organizationName: getOrganizationName(primaryRole.organization_type as string, primaryRole.organization_id as string),
            permissions: primaryRole.permissions || {}
          },
          availableRoles
        }

        console.log('✅ [AUTH] Fallback profile fetch successful:', {
          id: userProfile.id,
          email: userProfile.email,
          activeRole: userProfile.activeRole.roleType
        })

        return userProfile
      })()

      // Race between timeout and fallback
      const result = await Promise.race([fallbackPromise, fallbackTimeoutPromise])
      return result

    } catch (error) {
      console.error('❌ [AUTH] Fallback profile fetch exception:', error)
      
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('⏰ [AUTH] Fallback method timed out - this suggests a database issue')
        console.log('   The fallback method should complete within 10 seconds')
      }
      
      return null
    }
  }

  // Clean auth initialization
  useEffect(() => {
    let mounted = true
    console.log('🚀 [AUTH] Auth initialization started')

    const initializeAuth = async () => {
      try {
        console.log('🔍 [AUTH] Getting initial session...')
        // Get initial session
        const supabase = getSupabase()
    const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ Session error:', error)
          if (mounted) setLoading(false)
          return
        }

        console.log('🔍 [AUTH] Session result:', { hasSession: !!session, hasUser: !!session?.user })

        if (session?.user) {
          console.log('✅ [AUTH] Setting user and session')
          setUser(session.user)
          setSession(session)
          
          // Fetch profile
          console.log('🔍 [AUTH] Fetching user profile...')
          const userProfile = await fetchUserProfile(session.user.id)
          console.log('🔍 [AUTH] Profile fetch result:', { hasProfile: !!userProfile })
          
          if (mounted && userProfile) {
            console.log('✅ [AUTH] Setting user profile')
            setProfile(userProfile)
          } else {
            console.log('❌ [AUTH] No profile found or component unmounted')
          }
        } else {
          console.log('ℹ️ [AUTH] No session found')
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
      } finally {
        console.log('🔍 [AUTH] Setting loading to false')
        if (mounted) setLoading(false)
      }
    }

    // Set up auth state listener
    const supabase = getSupabase()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 [AUTH] Auth state change:', { event, hasSession: !!session, hasUser: !!session?.user })
      
      if (!mounted) {
        console.log('🔄 [AUTH] Component unmounted, ignoring event')
        return
      }

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ [AUTH] SIGNED_IN event, setting user and session')
        setUser(session.user)
        setSession(session)
        setLoading(true)
        
        console.log('🔍 [AUTH] Fetching profile for SIGNED_IN event...')
        const userProfile = await fetchUserProfile(session.user.id)
        console.log('🔍 [AUTH] Profile fetch result for SIGNED_IN:', { hasProfile: !!userProfile })
        
        if (mounted && userProfile) {
          console.log('✅ [AUTH] Setting profile for SIGNED_IN event')
          setProfile(userProfile)
        }
        console.log('🔍 [AUTH] Setting loading to false for SIGNED_IN')
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 [AUTH] SIGNED_OUT event, clearing state')
        setUser(null)
        setSession(null)
        setProfile(null)
        setLoading(false)
      } else {
        console.log('ℹ️ [AUTH] Other auth event:', event)
      }
    })

    // Initialize auth
    initializeAuth()

    // Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Auth functions
  const signIn = async (email: string, password: string) => {
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    try {
      // Clear role session token from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('roleSessionToken')
      }
      
      // Sign out from Supabase
      const supabase = getSupabase()
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Sign out error:', error)
        throw error
      }
      
      // Clear local state immediately
      setUser(null)
      setSession(null)
      setProfile(null)
      setLoading(false)
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
      
    } catch (error) {
      console.error('❌ Error during sign out:', error)
      // Even if there's an error, clear local state
      setUser(null)
      setSession(null)
      setProfile(null)
      setLoading(false)
      
      // Still redirect to login page even if there was an error
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
    }
  }

  const resetPassword = async (email: string) => {
    const supabase = getSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  const refreshUser = async () => {
    if (user) {
      const userProfile = await fetchUserProfile(user.id)
      if (userProfile) {
        setProfile(userProfile)
      }
    }
  }

  // Computed values
  const isPlatformAdmin = profile?.activeRole.roleType === 'platform_admin'
  const isAgencyAdmin = profile?.activeRole.roleType === 'agency_admin'
  const isClientAdmin = profile?.activeRole.roleType === 'client_admin'

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    isPlatformAdmin,
    isAgencyAdmin,
    isClientAdmin,
    signIn,
    signOut,
    resetPassword,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 