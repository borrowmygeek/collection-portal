'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Version identifier to help with cache busting and debugging
console.log('🔄 Auth Context v2.0 - Clean Implementation Loaded')

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

  // Simple, clean profile fetch function
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log('🔍 Fetching user profile for:', userId)
      
      // Get basic profile data
      const { data: profileData, error: profileError } = await supabase
        .from('platform_users')
        .select('id, email, auth_user_id, full_name, status')
        .eq('auth_user_id', userId)
        .single()

      if (profileError || !profileData) {
        console.error('❌ Profile fetch error:', profileError)
        return null
      }

      console.log('✅ Basic profile fetched:', profileData.id)

      // Get role session token from localStorage if available
      let roleSessionToken: string | null = null
      if (typeof window !== 'undefined') {
        roleSessionToken = localStorage.getItem('roleSessionToken')
      }

      // Get active role with session token if available
      const activeRoleResult = await supabase.rpc('get_user_active_role', { 
        p_user_id: profileData.id,
        p_session_token: roleSessionToken
      })

      // Get all roles
      const allRolesResult = await supabase.rpc('get_user_roles_simple', { p_user_id: profileData.id })

      if (activeRoleResult.error) {
        console.error('❌ Active role fetch error:', activeRoleResult.error)
        return null
      }

      if (allRolesResult.error) {
        console.error('❌ All roles fetch error:', allRolesResult.error)
        return null
      }

      if (!activeRoleResult.data) {
        console.error('❌ No active role found')
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

      console.log('✅ User profile loaded successfully')
      return userProfile

    } catch (error) {
      console.error('❌ Profile fetch failed:', error)
      return null
    }
  }

  // Clean auth initialization
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔄 [AUTH v2.0] Initializing clean auth system...')
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ Session error:', error)
          if (mounted) setLoading(false)
          return
        }

        if (session?.user) {
          console.log('🔄 User session found:', session.user.email)
          setUser(session.user)
          setSession(session)
          
          // Fetch profile
          const userProfile = await fetchUserProfile(session.user.id)
          if (mounted && userProfile) {
            setProfile(userProfile)
          }
        } else {
          console.log('🔄 No session found')
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email)
      
      if (!mounted) return

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        setSession(session)
        setLoading(true)
        
        const userProfile = await fetchUserProfile(session.user.id)
        if (mounted && userProfile) {
          setProfile(userProfile)
        }
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setSession(null)
        setProfile(null)
        setLoading(false)
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
    const { error } = await supabase.auth.signOut()
    if (error) console.error('❌ Sign out error:', error)
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