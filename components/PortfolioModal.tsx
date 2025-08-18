'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MasterPortfolio, MasterClient } from '@/types/database'
import { authenticatedFetch } from '@/lib/supabase'

interface PortfolioModalProps {
  isOpen: boolean
  onClose: () => void
  onPortfolioSaved: (portfolio: MasterPortfolio) => void
  portfolio?: MasterPortfolio | null // null for create, Portfolio for edit
  clientId?: string // Optional client ID to pre-select
}

export default function PortfolioModal({
  isOpen,
  onClose,
  onPortfolioSaved,
  portfolio,
  clientId
}: PortfolioModalProps) {
  const [clients, setClients] = useState<MasterClient[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState<{
    name: string
    description: string
    client_id: string
    portfolio_type: MasterPortfolio['portfolio_type']
    status: MasterPortfolio['status']
    contingency_rate: number
    min_settlement_rate: number
  }>({
    name: '',
    description: '',
    client_id: clientId || '',
    portfolio_type: 'credit_card',
    status: 'active',
    contingency_rate: 0.30,
    min_settlement_rate: 0.70
  })

  const isEditing = !!portfolio

  useEffect(() => {
    if (isOpen) {
      fetchClients()
      if (portfolio) {
        // Editing existing portfolio
        setFormData({
          name: portfolio.name,
          description: portfolio.description || '',
          client_id: portfolio.client_id,
          portfolio_type: portfolio.portfolio_type,
          status: portfolio.status,
          contingency_rate: 0.30, // Default value since not in current schema
          min_settlement_rate: 0.70 // Default value since not in current schema
        })
      } else {
        // Creating new portfolio
        setFormData({
          name: '',
          description: '',
          client_id: clientId || '',
          portfolio_type: 'credit_card',
          status: 'active',
          contingency_rate: 0.30,
          min_settlement_rate: 0.70
        })
      }
      setError('')
    }
  }, [isOpen, portfolio, clientId])

  const fetchClients = async () => {
    try {
      const response = await authenticatedFetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setLoading(true)
    setError('')

    try {
      const payload = {
        ...formData,
        original_balance: 0, // Will be calculated from imported accounts
        account_count: 0, // Will be calculated from imported accounts
        charge_off_date: null,
        debt_age_months: null,
        average_balance: null,
        geographic_focus: [],
        credit_score_range: ''
      }

      const url = isEditing ? `/api/portfolios/${portfolio!.id}` : '/api/portfolios'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        onPortfolioSaved(data.portfolio || data)
        onClose()
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} portfolio`)
      }
    } catch (error) {
      setError(`An error occurred while ${isEditing ? 'updating' : 'creating'} the portfolio`)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'contingency_rate' || field === 'min_settlement_rate' ? parseFloat(value) || 0 : value
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Portfolio' : 'Create New Portfolio'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div>
            <Label htmlFor="name">Portfolio Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              placeholder="Enter portfolio name"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={2}
              placeholder="Enter portfolio description"
            />
          </div>

          <div>
            <Label htmlFor="client_id">Client *</Label>
            <select
              id="client_id"
              value={formData.client_id}
              onChange={(e) => handleInputChange('client_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="portfolio_type">Portfolio Type *</Label>
            <select
              id="portfolio_type"
              value={formData.portfolio_type || ''}
              onChange={(e) => handleInputChange('portfolio_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="credit_card">Credit Card</option>
              <option value="medical">Medical</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="auto_loan">Auto Loan</option>
              <option value="mortgage">Mortgage</option>
              <option value="utility">Utility</option>
              <option value="payday_cash_loan">Payday/Cash Loan</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <Label htmlFor="status">Status *</Label>
            <select
              id="status"
              value={formData.status || ''}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="completed">Completed</option>
              <option value="returned">Returned</option>
              <option value="for_sale">For Sale</option>
            </select>
          </div>

          {/* Collection Terms */}
          <div>
            <Label htmlFor="contingency_rate">Contingency Rate (%) *</Label>
            <Input
              id="contingency_rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.contingency_rate * 100}
              onChange={(e) => handleInputChange('contingency_rate', (parseFloat(e.target.value) / 100).toString())}
              required
              placeholder="30.00"
            />
            <p className="text-sm text-gray-500 mt-1">Percentage of collected amount that goes to the collection agency</p>
          </div>

          <div>
            <Label htmlFor="min_settlement_rate">Minimum Settlement Rate (%) *</Label>
            <Input
              id="min_settlement_rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.min_settlement_rate * 100}
              onChange={(e) => handleInputChange('min_settlement_rate', (parseFloat(e.target.value) / 100).toString())}
              required
              placeholder="70.00"
            />
            <p className="text-sm text-gray-500 mt-1">Minimum percentage of original balance required for settlement</p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Portfolio' : 'Create Portfolio')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 