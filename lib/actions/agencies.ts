'use server'

import { createClient } from '@supabase/supabase-js'

// Create admin client function - lazy-loaded to prevent build-time execution
function createAgenciesSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export interface MasterAgency {
  id: string
  name: string
  contact_email: string
  contact_phone: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip_code: string
  status: 'active' | 'inactive' | 'suspended'
  subscription_tier: 'basic' | 'premium' | 'enterprise'
  created_at: string
  updated_at: string
}

export async function getAgencies(): Promise<MasterAgency[]> {
  try {
    const supabase = createAgenciesSupabaseClient()
    const { data, error } = await supabase
      .from('master_agencies')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching agencies:', error)
    return []
  }
}

export async function getAgencyById(id: string): Promise<MasterAgency | null> {
  try {
    const supabase = createAgenciesSupabaseClient()
    const { data, error } = await supabase
      .from('master_agencies')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching agency:', error)
    return null
  }
}

export async function createAgency(agencyData: Omit<MasterAgency, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAgenciesSupabaseClient()
    const { error } = await supabase
      .from('master_agencies')
      .insert([agencyData])

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error creating agency:', error)
    return { success: false, error: 'Failed to create agency' }
  }
}

export async function updateAgency(id: string, updates: Partial<MasterAgency>): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAgenciesSupabaseClient()
    const { error } = await supabase
      .from('master_agencies')
      .update(updates)
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error updating agency:', error)
    return { success: false, error: 'Failed to update agency' }
  }
}

export async function deleteAgency(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAgenciesSupabaseClient()
    const { error } = await supabase
      .from('master_agencies')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting agency:', error)
    return { success: false, error: 'Failed to delete agency' }
  }
} 