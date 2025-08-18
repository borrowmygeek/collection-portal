'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlusIcon } from '@heroicons/react/24/outline'
import PortfolioModal from './PortfolioModal'
import { authenticatedFetch } from '@/lib/supabase'

interface Portfolio {
  id: string
  name: string
  description: string | null
  portfolio_type: string
  status: string
  client_id: string
  client?: {
    id: string
    name: string
    code: string
    client_type: string
  }
}

interface Client {
  id: string
  name: string
  code: string
  status: string
}

interface PortfolioSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (portfolioId: string | null, newPortfolio?: any) => void
  clientId?: string
}

export default function PortfolioSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  clientId
}: PortfolioSelectionModalProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('')
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchPortfolios()
    }
  }, [isOpen])

  const fetchPortfolios = async () => {
    setLoading(true)
    try {
      const url = `/api/portfolios`
      
      console.log('Fetching portfolios from:', url)
      const response = await authenticatedFetch(url)
      const data = await response.json()
      
      console.log('Portfolio API response:', data)
      
      // Handle both array and object responses
      if (Array.isArray(data)) {
        setPortfolios(data)
        console.log('Set portfolios (array):', data.length)
      } else if (data.portfolios) {
        setPortfolios(data.portfolios)
        console.log('Set portfolios (object):', data.portfolios.length)
      } else {
        setPortfolios([])
        console.log('No portfolios found')
      }
    } catch (error) {
      console.error('Error fetching portfolios:', error)
      setPortfolios([])
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    onConfirm(selectedPortfolioId || null)
    onClose()
  }

  const handlePortfolioCreated = (portfolio: any) => {
    // Refresh the portfolios list
    fetchPortfolios()
    // Select the newly created portfolio
    setSelectedPortfolioId(portfolio.id)
  }

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId)

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Portfolio for Import</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create New Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => setIsPortfolioModalOpen(true)}
                className="flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create New Portfolio
              </Button>
            </div>

            {/* Portfolio Selection */}
            <div className="space-y-4">
              <div>
                <label htmlFor="portfolio-select" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Portfolio
                </label>
                <select
                  id="portfolio-select"
                  value={selectedPortfolioId}
                  onChange={(e) => setSelectedPortfolioId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                >
                  <option value="">{loading ? "Loading portfolios..." : "Choose a portfolio..."}</option>
                  {portfolios.map(portfolio => (
                    <option key={portfolio.id} value={portfolio.id}>
                      {portfolio.name} ({portfolio.client?.name || 'Unknown Client'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPortfolio && (
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">
                          {selectedPortfolio.name}
                        </h4>
                        <Badge variant="outline">
                          {selectedPortfolio.portfolio_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedPortfolio.description}
                      </p>
                      <div className="text-sm text-gray-500">
                        Client: {selectedPortfolio.client?.name}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={!selectedPortfolioId}
              >
                Confirm Selection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Portfolio Creation Modal */}
      <PortfolioModal
        isOpen={isPortfolioModalOpen}
        onClose={() => setIsPortfolioModalOpen(false)}
        onPortfolioSaved={handlePortfolioCreated}
        clientId={clientId}
      />
    </>
  )
} 