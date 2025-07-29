'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface PlacePortfolioModalProps {
  isOpen: boolean
  onClose: () => void
  onPortfolioPlaced: () => void
  portfolio: {
    id: string
    name: string
    original_balance: number
    account_count: number
    client_id: string
  } | null
}

interface PlacementFormData {
  agency_id: string
  placement_amount: string
  account_count: string
  contingency_rate: string
  min_settlement_rate: string
  flat_fee_rate: string
  placement_date: string
  status: string
}

interface Agency {
  id: string
  name: string
  code: string
  status: string
}

export default function PlacePortfolioModal({ isOpen, onClose, onPortfolioPlaced, portfolio }: PlacePortfolioModalProps) {
  const [formData, setFormData] = useState<PlacementFormData>({
    agency_id: '',
    placement_amount: '',
    account_count: '',
    contingency_rate: '30',
    min_settlement_rate: '70',
    flat_fee_rate: '',
    placement_date: new Date().toISOString().split('T')[0],
    status: 'active'
  })
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && portfolio) {
      setFormData(prev => ({
        ...prev,
        placement_amount: portfolio.original_balance.toString(),
        account_count: portfolio.account_count.toString()
      }))
      fetchAgencies()
    }
  }, [isOpen, portfolio])

  const fetchAgencies = async () => {
    try {
      console.log('Fetching agencies...')
      const response = await fetch('/api/agencies')
      console.log('Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Agencies data:', data)
        setAgencies(data)
      } else {
        console.error('Failed to fetch agencies:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching agencies:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/portfolio-placements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolio_id: portfolio.id,
          agency_id: formData.agency_id,
          client_id: portfolio.client_id,
          placement_date: formData.placement_date,
          placement_amount: parseFloat(formData.placement_amount),
          account_count: parseInt(formData.account_count),
          contingency_rate: parseFloat(formData.contingency_rate) / 100,
          min_settlement_rate: parseFloat(formData.min_settlement_rate) / 100,
          flat_fee_rate: formData.flat_fee_rate ? parseFloat(formData.flat_fee_rate) : null,
          status: formData.status
        }),
      })

      if (response.ok) {
        onPortfolioPlaced()
        onClose()
        setFormData({
          agency_id: '',
          placement_amount: '',
          account_count: '',
          contingency_rate: '30',
          min_settlement_rate: '70',
          flat_fee_rate: '',
          placement_date: new Date().toISOString().split('T')[0],
          status: 'active'
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to place portfolio')
      }
    } catch (error) {
      setError('An error occurred while placing the portfolio')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (!isOpen || !portfolio) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Place Portfolio with Agency</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Portfolio Summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Portfolio Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>
              <span className="ml-2 font-medium">{portfolio.name}</span>
            </div>
            <div>
              <span className="text-gray-500">Original Balance:</span>
              <span className="ml-2 font-medium">
                ${new Intl.NumberFormat('en-US').format(portfolio.original_balance)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Account Count:</span>
              <span className="ml-2 font-medium">
                {new Intl.NumberFormat('en-US').format(portfolio.account_count)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Average Balance:</span>
              <span className="ml-2 font-medium">
                ${new Intl.NumberFormat('en-US').format(portfolio.original_balance / portfolio.account_count)}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Agency Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agency * ({agencies.length} agencies available)
            </label>
            <select
              name="agency_id"
              value={formData.agency_id}
              onChange={handleInputChange}
              required
              className="input-field w-full"
            >
              <option value="">Select Agency</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name} ({agency.code})
                </option>
              ))}
            </select>
            {agencies.length === 0 && (
              <p className="text-sm text-red-600 mt-1">
                No agencies available. Please create agencies first.
              </p>
            )}
          </div>

          {/* Placement Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placement Amount *
              </label>
              <input
                type="number"
                name="placement_amount"
                value={formData.placement_amount}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                className="input-field w-full"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Count *
              </label>
              <input
                type="number"
                name="account_count"
                value={formData.account_count}
                onChange={handleInputChange}
                required
                min="1"
                max={portfolio.account_count}
                className="input-field w-full"
                placeholder="Number of accounts"
              />
            </div>
          </div>

          {/* Collection Terms */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Collection Terms</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contingency Rate (%)
                </label>
                <input
                  type="number"
                  name="contingency_rate"
                  value={formData.contingency_rate}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  className="input-field w-full"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Percentage of collections agency keeps
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Settlement Rate (%)
                </label>
                <input
                  type="number"
                  name="min_settlement_rate"
                  value={formData.min_settlement_rate}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  className="input-field w-full"
                  placeholder="70"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum settlement percentage
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flat Fee Rate ($)
                </label>
                <input
                  type="number"
                  name="flat_fee_rate"
                  value={formData.flat_fee_rate}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="input-field w-full"
                  placeholder="Optional flat fee"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional flat fee per account
                </p>
              </div>
            </div>
          </div>

          {/* Placement Date and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placement Date *
              </label>
              <input
                type="date"
                name="placement_date"
                value={formData.placement_date}
                onChange={handleInputChange}
                required
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                required
                className="input-field w-full"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="returned">Returned</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Placing...' : 'Place Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 