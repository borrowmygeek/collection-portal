'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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
  const fetchUserProfile = async (userId: string, retryCount = 0): Promise<UserProfile | null> => {
    const maxRetries = 2 // Max retries for profile fetch
    const supabase = getSupabase()
    
    try {
      console.log(`🔍 [AUTH] Starting profile fetch for user: ${userId} (attempt ${retryCount + 1}/${maxRetries + 1})`)
      
      // Monitor Supabase client state
      console.log('🔍 [AUTH] Supabase client state:', {
        hasAuth: !!supabase.auth,
        hasRpc: !!supabase.rpc,
        hasFrom: !!supabase.from,
        timestamp: new Date().toISOString()
      })
      
      // Add timeout to prevent hanging (increased to 15 seconds to handle slow database)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout after 15 seconds')), 15000)
      })

      const profileFetchPromise = (async () => {
        // OPTIMIZED: Single query to get profile + roles + permissions in one database call
        console.log('🔍 [AUTH] Executing OPTIMIZED profile fetch with single query...')
        
        const queryStartTime = Date.now()
        
        // OPTIMIZED: Get profile and roles in parallel instead of separate queries
        console.log('🔍 [AUTH] Executing parallel profile and roles queries...')
        
        // Query 1: Get basic profile
        const profilePromise = supabase
          .from('platform_users')
          .select('id, email, auth_user_id, full_name, status')
          .eq('auth_user_id', userId)
          .single()
        
        // Query 2: Get user roles (parallel)
        const rolesPromise = supabase
          .from('user_roles')
          .select('id, role_type, organization_type, organization_id, is_active, is_primary, permissions')
          .eq('user_id', userId)
          .eq('is_active', true)
        
                // Execute both queries in parallel
        const [profileResult, rolesResult] = await Promise.all([profilePromise, rolesPromise])
        
        const queryTime = Date.now() - queryStartTime
        console.log(`🔍 [AUTH] PARALLEL queries completed in ${queryTime}ms`)
        
        // Log performance warning if query is slow
        if (queryTime > 5000) {
          console.warn(`⚠️ [AUTH] SLOW QUERY: PARALLEL profile fetch took ${queryTime}ms (should be < 1000ms)`)
        }
        
        // Check for errors
        if (profileResult.error) {
          console.error('❌ Profile query error:', profileResult.error)
          return null
        }
        
        if (rolesResult.error) {
          console.error('❌ Roles query error:', rolesResult.error)
          return null
        }
        
        const profileData = profileResult.data as any
        const userRoles = (rolesResult.data || []) as any[]
        
        console.log('🔍 [AUTH] Query result:', { 
          hasData: !!profileData, 
          hasRoles: !!userRoles,
          queryTime,
          rolesCount: userRoles.length
        })

        if (!profileData) {
          console.error('❌ No profile data found')
          return null
        }

        console.log('✅ [AUTH] OPTIMIZED profile data fetched:', {
          id: profileData.id,
          email: profileData.email,
          rolesCount: profileData.user_roles?.length || 0
        })

        // Process the roles data from the parallel queries
        if (!userRoles || userRoles.length === 0) {
          console.error('❌ No active roles found for user:', profileData.id)
          return null
        }

        // Find the primary role (or first active role if no primary)
        const primaryRole = userRoles.find((role: any) => role.is_primary) || userRoles[0]
        
        if (!primaryRole) {
          console.error('❌ No valid role found for user:', profileData.id)
          return null
        }

        console.log('✅ [AUTH] Primary role identified:', {
          roleType: primaryRole.role_type,
          organizationType: primaryRole.organization_type,
          organizationId: primaryRole.organization_id
        })

        // Transform the roles data to camelCase format
        const availableRoles = userRoles.map((role: any) => ({
          id: role.id,
          roleType: role.role_type,
          organizationType: role.organization_type,
          organizationId: role.organization_id,
          organizationName: getOrganizationName(role.organization_type, role.organization_id),
          permissions: role.permissions || {}
        }))

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
            organizationName: getOrganizationName(primaryRole.organization_type, primaryRole.organization_id),
            permissions: primaryRole.permissions || {}
          },
          availableRoles
        }

        console.log('✅ [AUTH] User profile constructed successfully:', userProfile)
        
        // Remove the problematic role session creation - this should be handled server-side
        // The user can work without a role session token initially
        
        return userProfile
      })()

      // Race between timeout and profile fetch
      const result = await Promise.race([profileFetchPromise, timeoutPromise]) as UserProfile | null
      console.log('✅ [AUTH] Profile fetch completed successfully')
      return result

    } catch (error) {
      console.error(`❌ Profile fetch failed (attempt ${retryCount + 1}):`, error)
      
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error('⏰ [AUTH] Profile fetch timed out - this suggests a database function issue')
        
        // Retry on timeout if we haven't exceeded max retries
        if (retryCount < maxRetries) {
                  console.log(`🔄 [AUTH] Retrying profile fetch in 500ms... (${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 500))
          return fetchUserProfile(userId, retryCount + 1)
        } else {
          console.error(`❌ [AUTH] Max retries (${maxRetries}) exceeded for profile fetch`)
        }
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