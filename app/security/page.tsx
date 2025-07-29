'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@/lib/auth-context'
import { Sidebar } from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AuditLog {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  details: any
  ip_address: string
  user_agent: string
  session_id?: string
  success: boolean
  error_message?: string
  created_at: string
}

interface SecurityStats {
  totalEvents: number
  failedEvents: number
  uniqueUsers: number
  uniqueIPs: number
  recentActivity: number
}

export default function SecurityPage() {
  const { user } = useAuth()
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [securityStats, setSecurityStats] = useState<SecurityStats>({
    totalEvents: 0,
    failedEvents: 0,
    uniqueUsers: 0,
    uniqueIPs: 0,
    recentActivity: 0
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    action: '',
    resourceType: '',
    success: '',
    dateRange: '24h'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (user) {
      fetchSecurityData()
    }
  }, [user, filter, currentPage])

  const fetchSecurityData = async () => {
    try {
      setLoading(true)
      
      // Fetch audit logs with filters
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * 20, currentPage * 20 - 1)

      if (filter.action) {
        query = query.eq('action', filter.action)
      }
      if (filter.resourceType) {
        query = query.eq('resource_type', filter.resourceType)
      }
      if (filter.success !== '') {
        query = query.eq('success', filter.success === 'true')
      }
      if (filter.dateRange) {
        const now = new Date()
        let startDate = new Date()
        switch (filter.dateRange) {
          case '1h':
            startDate.setHours(now.getHours() - 1)
            break
          case '24h':
            startDate.setDate(now.getDate() - 1)
            break
          case '7d':
            startDate.setDate(now.getDate() - 7)
            break
          case '30d':
            startDate.setDate(now.getDate() - 30)
            break
        }
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data: logs, error, count } = await query

      if (error) {
        console.error('Error fetching audit logs:', error)
        return
      }

      setAuditLogs(logs || [])
      setTotalPages(Math.ceil((count || 0) / 20))

      // Fetch security statistics
      await fetchSecurityStats()

    } catch (error) {
      console.error('Error fetching security data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSecurityStats = async () => {
    try {
      // Get total events in last 24 hours
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const { count: totalEvents } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())

      // Get failed events in last 24 hours
      const { count: failedEvents } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())
        .eq('success', false)

      // Get unique users in last 24 hours
      const { data: uniqueUsers } = await supabase
        .from('audit_logs')
        .select('user_id')
        .gte('created_at', yesterday.toISOString())
        .not('user_id', 'is', null)

      // Get unique IPs in last 24 hours
      const { data: uniqueIPs } = await supabase
        .from('audit_logs')
        .select('ip_address')
        .gte('created_at', yesterday.toISOString())
        .not('ip_address', 'is', null)

      // Get recent activity (last hour)
      const lastHour = new Date()
      lastHour.setHours(lastHour.getHours() - 1)
      
      const { count: recentActivity } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastHour.toISOString())

      setSecurityStats({
        totalEvents: totalEvents || 0,
        failedEvents: failedEvents || 0,
        uniqueUsers: uniqueUsers ? new Set(uniqueUsers.map(u => u.user_id)).size : 0,
        uniqueIPs: uniqueIPs ? new Set(uniqueIPs.map(ip => ip.ip_address)).size : 0,
        recentActivity: recentActivity || 0
      })

    } catch (error) {
      console.error('Error fetching security stats:', error)
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes('FAILED') || action.includes('ERROR')) return 'destructive'
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'outline'
    if (action.includes('CREATE') || action.includes('UPDATE') || action.includes('DELETE')) return 'default'
    return 'outline'
  }

  const getSuccessBadge = (success: boolean) => {
    return success ? (
      <Badge variant="default" className="bg-green-500">Success</Badge>
    ) : (
      <Badge variant="destructive">Failed</Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader title="Security" />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
              <p className="text-gray-600">You must be logged in to view security information.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader title="Security" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Security Monitoring</h1>
              <Button onClick={fetchSecurityData} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>

            {/* Security Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{securityStats.totalEvents}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Events (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{securityStats.failedEvents}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Users (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{securityStats.uniqueUsers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique IPs (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{securityStats.uniqueIPs}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Activity (1h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{securityStats.recentActivity}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="action">Action</Label>
                    <Select value={filter.action} onValueChange={(value) => setFilter({...filter, action: value})}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue value={filter.action} placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All actions</SelectItem>
                        <SelectItem value="LOGIN_SUCCESS">Login Success</SelectItem>
                        <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
                        <SelectItem value="LOGOUT">Logout</SelectItem>
                        <SelectItem value="DATA_ACCESS">Data Access</SelectItem>
                        <SelectItem value="DATA_MODIFICATION">Data Modification</SelectItem>
                        <SelectItem value="SECURITY_VIOLATION">Security Violation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="resourceType">Resource Type</Label>
                    <Select value={filter.resourceType} onValueChange={(value) => setFilter({...filter, resourceType: value})}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue value={filter.resourceType} placeholder="All resources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All resources</SelectItem>
                        <SelectItem value="users">Users</SelectItem>
                        <SelectItem value="portfolios">Portfolios</SelectItem>
                        <SelectItem value="debtors">Debtors</SelectItem>
                        <SelectItem value="agencies">Agencies</SelectItem>
                        <SelectItem value="clients">Clients</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="success">Status</Label>
                    <Select value={filter.success} onValueChange={(value) => setFilter({...filter, success: value})}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue value={filter.success} placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="true">Success</SelectItem>
                        <SelectItem value="false">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dateRange">Time Range</Label>
                    <Select value={filter.dateRange} onValueChange={(value) => setFilter({...filter, dateRange: value})}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue value={filter.dateRange} placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">Last Hour</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                      <p className="mt-2">Loading audit logs...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No audit logs found matching the current filters.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-2">Timestamp</th>
                                <th className="text-left p-2">User</th>
                                <th className="text-left p-2">Action</th>
                                <th className="text-left p-2">Resource</th>
                                <th className="text-left p-2">IP Address</th>
                                <th className="text-left p-2">Status</th>
                                <th className="text-left p-2">Details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.map((log) => (
                                <tr key={log.id} className="border-b hover:bg-gray-50">
                                  <td className="p-2 text-xs">{formatDate(log.created_at)}</td>
                                  <td className="p-2">
                                    <Badge variant="outline">{truncateText(log.user_id, 20)}</Badge>
                                  </td>
                                  <td className="p-2">
                                    <Badge variant={getActionColor(log.action)}>
                                      {log.action}
                                    </Badge>
                                  </td>
                                  <td className="p-2">
                                    {log.resource_type}
                                    {log.resource_id && (
                                      <span className="text-gray-500 ml-1">({truncateText(log.resource_id, 10)})</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-xs">{log.ip_address}</td>
                                  <td className="p-2">
                                    {getSuccessBadge(log.success)}
                                  </td>
                                  <td className="p-2 text-xs">
                                    {log.error_message ? (
                                      <span className="text-red-600">{truncateText(log.error_message, 30)}</span>
                                    ) : (
                                      <span className="text-gray-500">{truncateText(JSON.stringify(log.details), 30)}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            Page {currentPage} of {totalPages}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 