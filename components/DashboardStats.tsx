'use client'

import { useEffect, useState } from 'react'
import { 
  BuildingOfficeIcon, 
  UserGroupIcon, 
  ChartBarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'

type ChangeType = 'positive' | 'negative' | 'neutral'

interface StatItem {
  name: string
  value: string
  change: string
  changeType: ChangeType
  icon: any
}

interface DashboardStats {
  totalAgencies: number
  activeUsers: number
  monthlyRevenue: number
  platformHealth: number
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgencies: 0,
    activeUsers: 1, // Show at least 1 for the current user
    monthlyRevenue: 0,
    platformHealth: 100
  })
  const [loading, setLoading] = useState(false) // Set to false to skip API call

  // Temporarily disabled API call to prevent dashboard from hanging
  /*
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])
  */

  const statsDisplay: StatItem[] = [
    {
      name: 'Total Agencies',
      value: loading ? '...' : stats.totalAgencies.toString(),
      change: '+0%',
      changeType: 'neutral',
      icon: BuildingOfficeIcon,
    },
    {
      name: 'Active Users',
      value: loading ? '...' : stats.activeUsers.toString(),
      change: '+0%',
      changeType: 'neutral',
      icon: UserGroupIcon,
    },
    {
      name: 'Monthly Revenue',
      value: loading ? '...' : `$${stats.monthlyRevenue.toLocaleString()}`,
      change: '+0%',
      changeType: 'neutral',
      icon: CurrencyDollarIcon,
    },
    {
      name: 'Platform Health',
      value: loading ? '...' : `${stats.platformHealth}%`,
      change: '+0%',
      changeType: 'neutral',
      icon: ChartBarIcon,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statsDisplay.map((item) => (
        <div
          key={item.name}
          className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6"
        >
          <dt>
            <div className="absolute rounded-md bg-indigo-500 p-3">
              <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500">
              {item.name}
            </p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
            <p
              className={`ml-2 flex items-baseline text-sm font-semibold ${
                item.changeType === 'positive'
                  ? 'text-green-600'
                  : item.changeType === 'negative'
                  ? 'text-red-600'
                  : 'text-gray-500'
              }`}
            >
              {item.change}
            </p>
          </dd>
        </div>
      ))}
    </div>
  )
} 