'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

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

  // Simple, clean profile fetch function with timeout and retry
  const fetchUserProfile = async (userId: string, retryCount = 0): Promise<UserProfile | null> => {
    const maxRetries = 2 // Max retries for profile fetch
    
    try {
      console.log(`🔍 [AUTH] Starting profile fetch for user: ${userId} (attempt ${retryCount + 1}/${maxRetries + 1})`)
      
      // Monitor Supabase client state
      console.log('🔍 [AUTH] Supabase client state:', {
        hasAuth: !!supabase.auth,
        hasRpc: !!supabase.rpc,
        hasFrom: !!supabase.from,
        timestamp: new Date().toISOString()
      })
      
      // Add timeout to prevent hanging (reduced to 5 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout after 5 seconds')), 5000)
      })

      const profileFetchPromise = (async () => {
        // Check database connection health first
        console.log('🔍 [AUTH] Checking database connection health...')
        const startTime = Date.now()
        
        try {
          // Test basic connection with a simple query
          const { data: healthCheck, error: healthError } = await supabase
            .from('platform_users')
            .select('id')
            .limit(1)
          
          const healthCheckTime = Date.now() - startTime
          console.log(`🔍 [AUTH] Database health check completed in ${healthCheckTime}ms:`, { 
            success: !healthError, 
            error: healthError,
            responseTime: healthCheckTime 
          })
          
          if (healthError) {
            console.error('❌ [AUTH] Database health check failed:', healthError)
            throw new Error(`Database connection failed: ${healthError.message}`)
          }
        } catch (healthError) {
          console.error('❌ [AUTH] Database health check exception:', healthError)
          throw healthError
        }

        // Get basic profile data
        console.log('🔍 [AUTH] Fetching basic profile data...')
        console.log('🔍 [AUTH] About to query platform_users table...')
        
        const queryStartTime = Date.now()
        const { data: profileData, error: profileError } = await supabase
          .from('platform_users')
          .select('id, email, auth_user_id, full_name, status')
          .eq('auth_user_id', userId)
          .single()

        const queryTime = Date.now() - queryStartTime
        console.log(`🔍 [AUTH] platform_users query completed in ${queryTime}ms`)
        console.log('🔍 [AUTH] Query result:', { data: profileData, error: profileError, queryTime })

        if (profileError || !profileData) {
          console.error('❌ Profile fetch error:', profileError)
          return null
        }

        console.log('✅ [AUTH] Basic profile data fetched:', profileData)

        // Get role session token from localStorage if available
        let roleSessionToken: string | null = null
        if (typeof window !== 'undefined') {
          roleSessionToken = localStorage.getItem('roleSessionToken')
        }

        console.log('🔍 [AUTH] Fetching active role for user:', profileData.id, 'with session token:', roleSessionToken ? 'present' : 'none')
        
        // Get active role with session token if available
        console.log('🔍 [AUTH] Calling get_user_active_role RPC...')
        const activeRoleResult = await supabase.rpc('get_user_active_role', { 
          p_user_id: profileData.id,
          p_session_token: roleSessionToken
        })

        console.log('🔍 [AUTH] Active role result:', activeRoleResult)

        // Get all roles
        console.log('🔍 [AUTH] Calling get_user_roles_simple RPC...')
        const allRolesResult = await supabase.rpc('get_user_roles_simple', { p_user_id: profileData.id })

        console.log('🔍 [AUTH] All roles result:', allRolesResult)

        if (activeRoleResult.error) {
          console.error('❌ Active role fetch error:', activeRoleResult.error)
          console.error('❌ Active role error details:', {
            code: activeRoleResult.error.code,
            message: activeRoleResult.error.message,
            details: activeRoleResult.error.details,
            hint: activeRoleResult.error.hint
          })
          return null
        }

        if (allRolesResult.error) {
          console.error('❌ All roles fetch error:', allRolesResult.error)
          console.error('❌ All roles error details:', {
            code: allRolesResult.error.code,
            message: allRolesResult.error.message,
            details: allRolesResult.error.details,
            hint: allRolesResult.error.hint
          })
          return null
        }

        if (!activeRoleResult.data) {
          console.error('❌ No active role found for user:', profileData.id)
          console.error('❌ Active role data was:', activeRoleResult.data)
          return null
        }

        // Transform the allRolesData to camelCase format
        const availableRoles = (Array.isArray(allRolesResult.data) ? allRolesResult.data : []).map((role: any) => ({
          id: role.id,
          roleType: role.role_type,
          organizationType: role.organization_type,
          organizationId: role.organization_id,
          organizationName: role.organization_name,
          permissions: role.permissions || {}
        }))

        const userProfile: UserProfile = {
          id: profileData.id as string,
          auth_user_id: profileData.auth_user_id as string,
          email: profileData.email as string,
          full_name: profileData.full_name as string,
          status: profileData.status as 'active' | 'inactive' | 'suspended',
          activeRole: {
            roleId: (activeRoleResult.data as any).role_id as string,
            roleType: (activeRoleResult.data as any).role_type as 'platform_admin' | 'agency_admin' | 'agency_user' | 'client_admin' | 'client_user' | 'buyer',
            organizationType: (activeRoleResult.data as any).organization_type as 'platform' | 'agency' | 'client' | 'buyer',
            organizationId: (activeRoleResult.data as any).organization_id as string,
            organizationName: (activeRoleResult.data as any).organization_name as string || 'Unknown Organization',
            permissions: (activeRoleResult.data as any).permissions || {}
          },
          availableRoles
        }

        console.log('✅ [AUTH] User profile constructed successfully:', userProfile)
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
          console.log(`🔄 [AUTH] Retrying profile fetch in 1 second... (${retryCount + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 1000))
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