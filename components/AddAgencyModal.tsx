'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface AddAgencyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddAgencyModal({ isOpen, onClose, onSuccess }: AddAgencyModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    code: string
    contact_name: string
    contact_email: string
    contact_phone: string
    address: string
    address_line2: string
    city: string
    state: string
    zipcode: string
    subscription_tier: 'basic' | 'professional' | 'enterprise'
    billing_cycle: 'monthly' | 'quarterly' | 'annual'
    base_monthly_fee: number
    max_users: number
    max_portfolios: number
    max_debtors: number
    storage_limit_gb: number

    notes: string
  }>({
    name: '',
    code: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    address_line2: '',
    city: '',
    state: '',
    zipcode: '',
    subscription_tier: 'basic',
    billing_cycle: 'monthly',
    base_monthly_fee: 99.00,
    max_users: 10,
    max_portfolios: 100,
    max_debtors: 10000,
    storage_limit_gb: 10,
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Debug: Check current user and permissions
      const { data: { user } } = await supabase.auth.getUser()
      console.log('🔍 Current User Debug Info:')
      console.log('User:', user)
      console.log('User Metadata:', user?.user_metadata)
      console.log('App Metadata:', user?.app_metadata)
      console.log('User Role:', user?.user_metadata?.role)
      console.log('App Role:', user?.app_metadata?.role)
      console.log('Is Platform Admin:', (user?.user_metadata?.role === 'platform_admin' || user?.app_metadata?.role === 'platform_admin'))
      
      // Debug: Check JWT token
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🔍 Session Debug Info:')
      console.log('Session:', session)
      console.log('JWT Token:', session?.access_token)
      
      // Generate a unique instance ID
      const instanceId = `agency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const newAgency = {
        ...formData,
        instance_id: instanceId,
        instance_url: `https://${instanceId}.supabase.co`,
        instance_anon_key: 'temp_key', // Will be updated when instance is created
        instance_service_key: 'temp_service_key', // Will be updated when instance is created
        subscription_status: 'pending' as const,
        subscription_start_date: new Date().toISOString().split('T')[0],
        features_enabled: {
          api_access: false,
          custom_domain: false,
          advanced_analytics: false,
          white_label: false,
          vonage_integration: false,
          dropco_integration: false,
          tcn_integration: false,
          tlo_integration: false,
          experian_integration: false
        },
        pci_dss_compliant: false,
        data_retention_days: 2555,
        security_settings: {
          mfa_required: true,
          session_timeout_minutes: 480,
          ip_whitelist: [],
          audit_logging: true
        },
        status: 'provisioning' as const,
        onboarding_stage: 'pending' as const
      }

      console.log('🔍 Attempting to insert agency:')
      console.log('Agency Data:', newAgency)

      // Use API route for admin operations (proper Supabase pattern)
      const response = await fetch('/api/admin/agencies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(newAgency),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Error creating agency:', errorData)
        console.log('🔍 Error Details:', errorData)
        alert('Error creating agency. Please try again.')
        return
      }

      console.log('✅ Agency created successfully!')

      onSuccess()
      onClose()
      setFormData({
        name: '',
        code: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        address_line2: '',
        city: '',
        state: '',
        zipcode: '',
        subscription_tier: 'basic',
        billing_cycle: 'monthly',
        base_monthly_fee: 99.00,
        max_users: 10,
        max_portfolios: 100,
        max_debtors: 10000,
        storage_limit_gb: 10,
        notes: ''
      })
    } catch (error) {
      console.error('❌ Error:', error)
      alert('Error creating agency. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('fee') || name.includes('users') || name.includes('portfolios') || name.includes('debtors') || name.includes('storage') 
        ? parseFloat(value) || 0 
        : value
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Add New Agency</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agency Name *
              </label>
              <input
                type="text"
                name="name"
                required
                className="input-field"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter agency name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agency Code *
              </label>
              <input
                type="text"
                name="code"
                required
                className="input-field"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Enter unique code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                name="contact_name"
                className="input-field"
                value={formData.contact_name}
                onChange={handleInputChange}
                placeholder="Enter contact name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email *
              </label>
              <input
                type="email"
                name="contact_email"
                required
                className="input-field"
                value={formData.contact_email}
                onChange={handleInputChange}
                placeholder="Enter contact email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                name="contact_phone"
                className="input-field"
                value={formData.contact_phone}
                onChange={handleInputChange}
                placeholder="Enter contact phone"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subscription Tier
              </label>
              <select
                name="subscription_tier"
                className="input-field"
                value={formData.subscription_tier}
                onChange={handleInputChange}
              >
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Cycle
              </label>
              <select
                name="billing_cycle"
                className="input-field"
                value={formData.billing_cycle}
                onChange={handleInputChange}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Fee ($)
              </label>
              <input
                type="number"
                name="base_monthly_fee"
                step="0.01"
                min="0"
                className="input-field"
                value={formData.base_monthly_fee}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Users
              </label>
              <input
                type="number"
                name="max_users"
                min="1"
                className="input-field"
                value={formData.max_users}
                onChange={handleInputChange}
              />
            </div>


          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              name="address"
              className="input-field"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter street address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <input
              type="text"
              name="address_line2"
              className="input-field"
              value={formData.address_line2}
              onChange={handleInputChange}
              placeholder="Apt, suite, unit, etc. (optional)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                className="input-field"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="Enter city"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                className="input-field"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="Enter state"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code
              </label>
              <input
                type="text"
                name="zipcode"
                className="input-field"
                value={formData.zipcode}
                onChange={handleInputChange}
                placeholder="Enter ZIP code"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              className="input-field"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Enter any additional notes"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Agency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 