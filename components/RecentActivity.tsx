'use client'

import { MasterAgency, MasterClient, MasterPortfolio } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface RecentActivityProps {
  agencies: MasterAgency[]
  clients: MasterClient[]
  portfolios: MasterPortfolio[]
}

export default function RecentActivity({ agencies, clients, portfolios }: RecentActivityProps) {
  // Combine all activities and sort by creation date
  const activities = [
    ...agencies.map(agency => ({
      type: 'agency' as const,
      name: agency.name,
      description: `Agency ${agency.status}`,
      date: agency.created_at,
      status: agency.status
    })),
    ...clients.map(client => ({
      type: 'client' as const,
      name: client.name,
      description: `Client ${client.client_type}`,
      date: client.created_at,
      status: client.status
    })),
    ...portfolios.map(portfolio => ({
      type: 'portfolio' as const,
      name: portfolio.name,
      description: `Portfolio ${portfolio.portfolio_type}`,
      date: portfolio.created_at,
      status: portfolio.status
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'agency':
        return '🏢'
      case 'client':
        return '👥'
      case 'portfolio':
        return '📁'
      default:
        return '📄'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600'
      case 'suspended':
        return 'text-red-600'
      case 'inactive':
        return 'text-gray-600'
      case 'completed':
        return 'text-blue-600'
      case 'returned':
        return 'text-orange-600'
      case 'for_sale':
        return 'text-purple-600'
      default:
        return 'text-yellow-600'
    }
  }

  return (
    <div className="space-y-3">
      {activities.length > 0 ? (
        activities.map((activity, index) => (
          <div key={index} className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {activity.name}
              </p>
              <p className="text-xs text-gray-500">
                {activity.description}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`text-xs font-medium ${getStatusColor(activity.status)}`}>
                  {activity.status}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No recent activity</p>
        </div>
      )}
    </div>
  )
} 