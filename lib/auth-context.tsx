'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  full_name: string
  role: 'platform_admin' | 'platform_user' | 'agency_admin' | 'agency_user'
  agency_id?: string
  permissions: any
  status: 'active' | 'inactive' | 'suspended'
  last_login_at?: string
  user_metadata?: { role: string }
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
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Computed boolean properties
  const isPlatformAdmin = profile?.role === 'platform_admin'
  const isAgencyAdmin = profile?.role === 'agency_admin'
  const isClientAdmin = profile?.role === 'agency_user' // Assuming client admin is agency_user

  // Fetch user profile from platform_users table
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log('🔍 Fetching user profile for userId:', userId)
      setProfileLoading(true)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000) // 10 second timeout
      })
      
      const fetchPromise = supabase
        .from('platform_users')
        .select('*')
        .eq('auth_user_id', userId)
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (error) {
        console.error('❌ Error fetching user profile:', error)
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        console.log('🔍 This might mean the user exists in auth.users but not in platform_users')
        console.log('🔍 The trigger that creates platform_users records might not be working')
        return null
      }

      console.log('✅ User profile found:', data)
      return data ? (data as unknown as UserProfile) : null
    } catch (error) {
      console.error('❌ Exception in fetchUserProfile:', error)
      console.error('❌ Exception type:', typeof error)
      console.error('❌ Exception message:', (error as any)?.message)
      return null
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔄 Auth context: Getting initial session...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('🔄 Auth context: Initial session result:', { hasSession: !!session, userEmail: session?.user?.email })
        
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          console.log('🔄 Auth context: Fetching initial profile...')
          // Fetch profile and wait for it to complete before setting loading to false
          const userProfile = await fetchUserProfile(session.user.id)
          setProfile(userProfile)
          console.log('🔄 Auth context: Initial profile loaded:', { hasProfile: !!userProfile })
        }
        
        // Only set loading to false after profile is fetched (or if no user)
        console.log('🔄 Auth context: Setting loading to false')
        setLoading(false)
      } catch (error) {
        console.error('❌ Error getting initial session:', error)
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth context: Auth state change:', event, session?.user?.email)
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          console.log('🔄 Auth context: Fetching profile after auth change...')
          // Fetch profile and wait for it to complete
          const userProfile = await fetchUserProfile(session.user.id)
          setProfile(userProfile)
          console.log('🔄 Auth context: Profile loaded after auth change:', { hasProfile: !!userProfile })
        } else {
          console.log('🔄 Auth context: No session, clearing profile')
          setProfile(null)
        }
        
        // Set loading to false after profile is fetched
        console.log('🔄 Auth context: Setting loading to false after auth change')
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔄 Auth context: Starting sign in...')
      setLoading(true) // Set loading to true during sign in
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      console.log('🔄 Auth context: Sign in response received', { 
        hasData: !!data, 
        hasError: !!error,
        hasUser: !!data?.user,
        hasSession: !!data?.session 
      })
      
      if (error) {
        console.error('❌ Auth context: Sign in error:', error)
        setLoading(false) // Reset loading on error
        return { error }
      }
      
      if (!data?.user || !data?.session) {
        console.error('❌ Auth context: No user or session in response')
        setLoading(false) // Reset loading on error
        return { error: { message: 'Authentication failed - no user or session returned' } }
      }
      
      console.log('✅ Auth context: Sign in successful')
      // Don't set loading to false here - let the auth state change handler do it
      return { error: null }
    } catch (err) {
      console.error('❌ Auth context: Unexpected error during sign in:', err)
      setLoading(false) // Reset loading on error
      return { error: { message: 'An unexpected error occurred during sign in' } }
    }
  }

  const signUp = async (email: string, password: string, userData: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { error }
  }

  const signOut = async () => {
    try {
      console.log('🔄 Starting sign out process...')
      
      // Clear local state first
      setUser(null)
      setSession(null)
      setProfile(null)
      
      // Call Supabase sign out
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Error during sign out:', error)
        throw error
      }
      
      console.log('✅ Sign out successful')
      
      // Force redirect to login page
      window.location.href = '/auth/login'
      
    } catch (error) {
      console.error('❌ Sign out failed:', error)
      // Even if there's an error, try to redirect to login
      window.location.href = '/auth/login'
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return { error: new Error('No profile to update') }
    
    const { error } = await supabase
      .from('platform_users')
      .update(updates)
      .eq('id', profile.id)
    
    if (!error) {
      setProfile({ ...profile, ...updates })
    }
    
    return { error }
  }

  const hasPermission = (permission: string): boolean => {
    if (!profile) return false
    if (profile.role === 'platform_admin') return true
    return profile.permissions?.[permission] === true
  }

  const value = {
    user,
    session,
    profile,
    loading: loading || profileLoading, // Consider both loading states
    isPlatformAdmin,
    isAgencyAdmin,
    isClientAdmin,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    hasPermission,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 