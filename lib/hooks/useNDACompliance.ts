import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/lib/supabase'

interface NDACompliance {
  is_compliant: boolean
  current_version: string
  user_version: string | null
  signed_at: string | null
  compliance_status: string
  message: string
}

interface NDAComplianceData {
  compliance: {
    user_id: string
    user_email: string
    user_name: string
    roles: any[]
    nda_compliance: NDACompliance
  } | null
  currentVersion: string
}

export function useNDACompliance() {
  const [compliance, setCompliance] = useState<NDAComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCompliance = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await authenticatedFetch('/api/nda/compliance')
      if (response.ok) {
        const data = await response.json()
        setCompliance(data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to fetch NDA compliance')
      }
    } catch (err) {
      console.error('Error fetching NDA compliance:', err)
      setError('Failed to fetch NDA compliance')
    } finally {
      setLoading(false)
    }
  }

  const refreshCompliance = () => {
    fetchCompliance()
  }

  useEffect(() => {
    fetchCompliance()
  }, [])

  const isCompliant = compliance?.compliance?.nda_compliance?.is_compliant || false
  const currentVersion = compliance?.currentVersion || '1.0'
  const complianceStatus = compliance?.compliance?.nda_compliance?.compliance_status || 'unknown'
  const complianceMessage = compliance?.compliance?.nda_compliance?.message || ''

  return {
    compliance,
    loading,
    error,
    isCompliant,
    currentVersion,
    complianceStatus,
    complianceMessage,
    refreshCompliance
  }
} 