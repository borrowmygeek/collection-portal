'use client'

import { MasterAgency } from '@/lib/supabase'
import { BuildingOfficeIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface AgencyCardProps {
  agency: MasterAgency
}

export default function AgencyCard({ agency }: AgencyCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'suspended':
        return 'text-red-600 bg-red-100'
      case 'inactive':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-yellow-600 bg-yellow-100'
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'text-purple-600 bg-purple-100'
      case 'professional':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900">{agency.name}</h4>
          </div>
          
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-500">Code: {agency.code}</p>
            <p className="text-xs text-gray-500">{agency.contact_email}</p>
          </div>
          
          <div className="mt-3 flex items-center space-x-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agency.status)}`}>
              {agency.status === 'active' ? (
                <CheckCircleIcon className="h-3 w-3 mr-1" />
              ) : (
                <XCircleIcon className="h-3 w-3 mr-1" />
              )}
              {agency.status}
            </span>
            
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTierColor(agency.subscription_tier)}`}>
              {agency.subscription_tier}
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            ${agency.base_monthly_fee}/mo
          </p>
          <p className="text-xs text-gray-500">
            {agency.max_users} users
          </p>
        </div>
      </div>
    </div>
  )
} 