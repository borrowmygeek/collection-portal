'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import { toast } from 'react-toastify'
import {
  TrashIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ImportJob {
  id: string
  file_name: string
  file_size: number
  file_type: string
  import_type: string
  status: string
  progress: number | null
  total_rows: number | null
  processed_rows: number | null
  created_at: string
  updated_at: string
  validation_results?: any
  processing_errors?: string[] | null
}

export default function AdminImportsPage() {
  const { user, isPlatformAdmin } = useAuth()
  const [imports, setImports] = useState<ImportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [clearingData, setClearingData] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedImport, setSelectedImport] = useState<ImportJob | null>(null)

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchImports()
    }
  }, [isPlatformAdmin])

  const fetchImports = async () => {
    try {
      const response = await authenticatedFetch('/api/import?limit=100')
      if (response.ok) {
        const data = await response.json()
        setImports(data.imports || [])
      } else {
        toast.error('Failed to fetch imports')
      }
    } catch (error) {
      console.error('Error fetching imports:', error)
      toast.error('Failed to fetch imports')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteImport = async (importJob: ImportJob) => {
    setSelectedImport(importJob)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteImport = async () => {
    if (!selectedImport) return

    try {
      const response = await authenticatedFetch(`/api/import?job_id=${selectedImport.id}&file_name=${encodeURIComponent(selectedImport.file_name)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Import job deleted successfully')
        fetchImports()
      } else {
        const errorData = await response.json()
        toast.error(`Failed to delete import: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error deleting import:', error)
      toast.error('Failed to delete import')
    } finally {
      setShowDeleteConfirm(false)
      setSelectedImport(null)
    }
  }

  const handleClearAllData = () => {
    setShowClearConfirm(true)
  }

  const confirmClearAllData = async () => {
    setClearingData(true)
    try {
      const response = await authenticatedFetch('/api/admin/clear-import-data', {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Data cleared successfully: ${result.message}`)
        fetchImports()
      } else {
        const errorData = await response.json()
        toast.error(`Failed to clear data: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error clearing data:', error)
      toast.error('Failed to clear data')
    } finally {
      setClearingData(false)
      setShowClearConfirm(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      case 'uploaded':
        return <DocumentArrowUpIcon className="h-5 w-5 text-blue-500" />
      case 'validating':
        return <DocumentMagnifyingGlassIcon className="h-5 w-5 text-blue-500 animate-pulse" />
      case 'validated':
        return <CheckCircleIcon className="h-5 w-5 text-blue-600" />
      case 'processing':
        return <DocumentArrowUpIcon className="h-5 w-5 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'cancelled':
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'uploaded':
        return 'bg-blue-100 text-blue-800'
      case 'validating':
        return 'bg-blue-100 text-blue-800'
      case 'validated':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (!user) {
    return <div>Loading...</div>
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Import Management</h1>
          <p className="mt-2 text-gray-600">Manage import jobs and clear data as needed.</p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex gap-4">
          <Button
            onClick={handleClearAllData}
            variant="destructive"
            disabled={clearingData}
            className="flex items-center gap-2"
          >
            {clearingData ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Clearing Data...
              </>
            ) : (
              <>
                <TrashIcon className="h-4 w-4" />
                Clear All Import Data
              </>
            )}
          </Button>
          
          <Button
            onClick={fetchImports}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Loading...
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>

        {/* Import Jobs List */}
        <Card>
          <CardHeader>
            <CardTitle>Import Jobs ({imports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading imports...</p>
              </div>
            ) : imports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No import jobs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {imports.map((importJob) => (
                      <tr key={importJob.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIcon(importJob.status)}
                            <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(importJob.status)}`}>
                              {importJob.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{importJob.file_name}</div>
                            <div className="text-sm text-gray-500">{formatFileSize(importJob.file_size)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {importJob.import_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${importJob.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{importJob.progress || 0}%</span>
                          </div>
                          {importJob.total_rows && (
                            <div className="text-xs text-gray-500 mt-1">
                              {importJob.processed_rows || 0} / {importJob.total_rows} rows
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(importJob.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button
                            onClick={() => handleDeleteImport(importJob)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <TrashIcon className="h-5 w-5" />
              Delete Import Job
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action cannot be undone. This will permanently delete:
              </p>
              <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
                <li>The import job record</li>
                <li>The uploaded file</li>
                {selectedImport?.status === 'completed' && (
                  <>
                    <li>All accounts/debt accounts from this specific import</li>
                    <li>All payment records for these accounts</li>
                    <li>All call logs and notes for these accounts</li>
                    <li>All skip-trace data for these accounts</li>
                    <li>Person records (only if not used by other accounts)</li>
                  </>
                )}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={confirmDeleteImport}
                variant="destructive"
                className="flex-1"
              >
                Delete Import Job
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Data Confirmation Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <TrashIcon className="h-5 w-5" />
              Clear All Import Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action cannot be undone. This will permanently delete:
              </p>
              <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
                <li>All data from persons table</li>
                <li>All data from debt_accounts table</li>
                <li>All related satellite data (addresses, phones, emails)</li>
                <li>All import performance metrics</li>
                <li>All import staging data</li>
              </ul>
              <p className="text-sm text-blue-700 mt-2 font-medium">
                <strong>Note:</strong> This will completely reset the system for fresh testing.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={confirmClearAllData}
                variant="destructive"
                className="flex-1"
                disabled={clearingData}
              >
                {clearingData ? 'Clearing...' : 'Clear All Data'}
              </Button>
              <Button
                onClick={() => setShowClearConfirm(false)}
                variant="outline"
                className="flex-1"
                disabled={clearingData}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
