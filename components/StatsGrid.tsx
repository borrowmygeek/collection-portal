'use client'

import { 
  BuildingOfficeIcon,
  UserGroupIcon,
  FolderIcon,
  CurrencyDollarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface StatsGridProps {
  stats: {
    totalAgencies: number
    activeAgencies: number
    totalClients: number
    totalPortfolios: number
    totalRevenue: number
    totalCollected: number
  }
}

const statItems = [
  {
    name: 'Total Agencies',
    value: 'totalAgencies',
    icon: BuildingOfficeIcon,
    color: 'bg-blue-500',
  },
  {
    name: 'Active Agencies',
    value: 'activeAgencies',
    icon: BuildingOfficeIcon,
    color: 'bg-green-500',
  },
  {
    name: 'Total Clients',
    value: 'totalClients',
    icon: UserGroupIcon,
    color: 'bg-purple-500',
  },
  {
    name: 'Total Portfolios',
    value: 'totalPortfolios',
    icon: FolderIcon,
    color: 'bg-orange-500',
  },
  {
    name: 'Total Revenue',
    value: 'totalRevenue',
    icon: CurrencyDollarIcon,
    color: 'bg-green-600',
    format: 'currency',
  },
  {
    name: 'Total Collected',
    value: 'totalCollected',
    icon: CurrencyDollarIcon,
    color: 'bg-emerald-600',
    format: 'currency',
  },

]

export default function StatsGrid({ stats }: StatsGridProps) {
  const formatValue = (value: number, format?: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }
    return value.toLocaleString()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {statItems.map((stat) => {
        const Icon = stat.icon
        const value = stats[stat.value as keyof typeof stats]
        
        return (
          <div key={stat.name} className="card">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg ${stat.color}`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatValue(value || 0, stat.format)}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 