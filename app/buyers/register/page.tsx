'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { 
  BuildingOfficeIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  MapPinIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface RegistrationForm {
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  website: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string
  country: string
}

interface NDAForm {
  agreement_accepted: boolean
  ip_address: string
  user_agent: string
}

const defaultForm: RegistrationForm = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  country: 'USA'
}

const defaultNDA: NDAForm = {
  agreement_accepted: false,
  ip_address: '',
  user_agent: ''
}

const states = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

const genericNDAText = `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement (the "Agreement") is entered into as of the date of electronic acceptance by and between:

[YOUR COMPANY NAME] ("Receiving Party")
and
Collection Portal ("Disclosing Party")

1. CONFIDENTIAL INFORMATION
The term "Confidential Information" means any information disclosed by the Disclosing Party to the Receiving Party, either directly or indirectly, in writing, orally or by inspection of tangible objects, which is designated as "Confidential," "Proprietary" or some similar designation, or that should reasonably be understood to be confidential given the nature of the information and the circumstances of disclosure.

2. NON-USE AND NON-DISCLOSURE
The Receiving Party agrees not to use any Confidential Information for any purpose except to evaluate and engage in discussions concerning a potential business relationship between the parties. The Receiving Party agrees not to disclose any Confidential Information to third parties or to the Receiving Party's employees, except to those employees who are required to have the information in order to evaluate or engage in discussions concerning the contemplated business relationship and who have signed confidentiality agreements with the Receiving Party containing protections no less stringent than those herein.

3. MAINTENANCE OF CONFIDENTIALITY
The Receiving Party agrees that it shall take reasonable measures to protect the secrecy of and avoid disclosure and unauthorized use of the Confidential Information. Without limiting the foregoing, the Receiving Party shall take at least those measures that it takes to protect its own confidential information of a similar nature.

4. REQUIRED DISCLOSURE
In the event that the Receiving Party is required by law, regulation, or court order to disclose any Confidential Information, the Receiving Party will promptly notify the Disclosing Party in writing prior to making any such disclosure in order to facilitate the Disclosing Party seeking a protective order or other appropriate remedy from the proper authority.

5. RETURN OF MATERIALS
Upon the termination of this Agreement or upon the written request of the Disclosing Party, the Receiving Party will promptly return to the Disclosing Party all copies of Confidential Information in tangible form or destroy all such copies and certify in writing to the Disclosing Party that such Confidential Information has been destroyed.

6. NO RIGHTS GRANTED
Nothing in this Agreement shall be construed as granting any rights under any patent, copyright or other intellectual property right of the Disclosing Party, nor shall this Agreement grant the Receiving Party any rights in or to the Disclosing Party's Confidential Information other than the limited right to review such Confidential Information solely for the purpose of determining whether to enter into a business relationship with the Disclosing Party.

7. TERM
This Agreement shall remain in effect for a period of two (2) years from the date of acceptance.

8. GENERAL PROVISIONS
This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which the Disclosing Party is located. If any provision of this Agreement is found by a court of competent jurisdiction to be illegal, invalid or unenforceable, the remaining provisions of this Agreement will remain in full force and effect.

By electronically accepting this Agreement, you acknowledge that you have read, understood, and agree to be bound by the terms and conditions of this Non-Disclosure Agreement.
`

export default function BuyerRegistrationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState<'registration' | 'nda' | 'complete'>('registration')
  const [form, setForm] = useState<RegistrationForm>(defaultForm)
  const [ndaForm, setNdaForm] = useState<NDAForm>(defaultNDA)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Get client IP and user agent on component mount
  useState(() => {
    setNdaForm(prev => ({
      ...prev,
      ip_address: typeof window !== 'undefined' ? window.location.hostname : '',
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : ''
    }))
  })

  const handleFormChange = (field: keyof RegistrationForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleNDAChange = (field: keyof NDAForm, value: boolean | string) => {
    setNdaForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateRegistrationForm = () => {
    if (!form.company_name.trim()) return 'Company name is required'
    if (!form.contact_name.trim()) return 'Contact name is required'
    if (!form.contact_email.trim()) return 'Contact email is required'
    if (!form.contact_email.includes('@')) return 'Valid email address is required'
    if (!form.contact_phone.trim()) return 'Contact phone is required'
    if (!form.address_line1.trim()) return 'Address is required'
    if (!form.city.trim()) return 'City is required'
    if (!form.state.trim()) return 'State is required'
    if (!form.zip_code.trim()) return 'ZIP code is required'
    return null
  }

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const validationError = validateRegistrationForm()
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/buyers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Registration failed')
      }

      const buyer = await response.json()
      setStep('nda')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleNDASubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!ndaForm.agreement_accepted) {
      setError('You must accept the NDA agreement to continue')
      setLoading(false)
      return
    }

    try {
      // Get the buyer ID from the previous step (you might want to store this in state)
      const response = await fetch('/api/buyers')
      const buyersData = await response.json()
      const currentBuyer = buyersData.buyers?.find((b: any) => b.contact_email === form.contact_email)
      
      if (!currentBuyer) {
        throw new Error('Buyer not found')
      }

      const ndaResponse = await fetch('/api/nda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyer_id: currentBuyer.id,
          agreement_text: genericNDAText,
          agreement_version: '1.0'
        }),
      })

      if (!ndaResponse.ok) {
        const errorData = await ndaResponse.json()
        throw new Error(errorData.error || 'NDA submission failed')
      }

      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NDA submission failed')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    router.push('/sales')
  }

  if (step === 'nda') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
          <div className="flex items-center justify-center">
            <DocumentTextIcon className="h-12 w-12 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Non-Disclosure Agreement
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please review and accept the NDA to access portfolio sales
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-4xl">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={handleNDASubmit} className="space-y-6">
              {/* NDA Text */}
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                  {genericNDAText}
                </pre>
              </div>

              {/* Agreement Checkbox */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="agreement"
                    name="agreement"
                    type="checkbox"
                    checked={ndaForm.agreement_accepted}
                    onChange={(e) => handleNDAChange('agreement_accepted', e.target.checked)}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="agreement" className="font-medium text-gray-700">
                    I have read, understood, and agree to the terms of this Non-Disclosure Agreement
                  </label>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep('registration')}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !ndaForm.agreement_accepted}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Accept & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex items-center justify-center">
            <CheckCircleIcon className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Registration Complete!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Your buyer account has been created and NDA has been accepted
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center space-y-4">
              <p className="text-gray-600">
                Welcome to the Collection Portal! You can now browse available portfolios for purchase.
              </p>
              <button
                onClick={handleComplete}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                Browse Portfolios
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex items-center justify-center">
          <BuildingOfficeIcon className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Buyer Registration
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Register as a buyer to access portfolio sales
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleRegistrationSubmit} className="space-y-6">
            {/* Company Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Company Information</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                    Company Name *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="company_name"
                      name="company_name"
                      type="text"
                      required
                      value={form.company_name}
                      onChange={(e) => handleFormChange('company_name', e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                    Website
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="website"
                      name="website"
                      type="url"
                      value={form.website}
                      onChange={(e) => handleFormChange('website', e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700">
                    Contact Name *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="contact_name"
                      name="contact_name"
                      type="text"
                      required
                      value={form.contact_name}
                      onChange={(e) => handleFormChange('contact_name', e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">
                    Contact Email *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="contact_email"
                      name="contact_email"
                      type="email"
                      required
                      value={form.contact_email}
                      onChange={(e) => handleFormChange('contact_email', e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700">
                    Contact Phone *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="contact_phone"
                      name="contact_phone"
                      type="tel"
                      required
                      value={form.contact_phone}
                      onChange={(e) => handleFormChange('contact_phone', e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="address_line1" className="block text-sm font-medium text-gray-700">
                    Address Line 1 *
                  </label>
                  <div className="mt-1">
                    <input
                      id="address_line1"
                      name="address_line1"
                      type="text"
                      required
                      value={form.address_line1}
                      onChange={(e) => handleFormChange('address_line1', e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="address_line2" className="block text-sm font-medium text-gray-700">
                    Address Line 2
                  </label>
                  <div className="mt-1">
                    <input
                      id="address_line2"
                      name="address_line2"
                      type="text"
                      value={form.address_line2}
                      onChange={(e) => handleFormChange('address_line2', e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                      City *
                    </label>
                    <div className="mt-1">
                      <input
                        id="city"
                        name="city"
                        type="text"
                        required
                        value={form.city}
                        onChange={(e) => handleFormChange('city', e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                      State *
                    </label>
                    <div className="mt-1">
                      <select
                        id="state"
                        name="state"
                        required
                        value={form.state}
                        onChange={(e) => handleFormChange('state', e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select State</option>
                        {states.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700">
                      ZIP Code *
                    </label>
                    <div className="mt-1">
                      <input
                        id="zip_code"
                        name="zip_code"
                        type="text"
                        required
                        value={form.zip_code}
                        onChange={(e) => handleFormChange('zip_code', e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Continue to NDA'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 