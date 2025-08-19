'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { authenticatedFetch } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Sidebar } from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import PortfolioModal from '@/components/PortfolioModal'
import FieldMappingModal from '@/components/FieldMappingModal'
import DeletePortfolioConfirmDialog from '@/components/DeletePortfolioConfirmDialog'
import ImportValidationResults from '@/components/ImportValidationResults'
import { 
  CloudArrowUpIcon, 
  DocumentArrowUpIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
  DocumentMagnifyingGlassIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ImportJob, ImportTemplate, ImportPreview } from '@/types/import'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'react-toastify'
import Link from 'next/link'

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

export default function ImportPage() {
  const { user, session, isPlatformAdmin } = useAuth()
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<string>('accounts')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Portfolio selection state
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null)
  const [newPortfolio, setNewPortfolio] = useState<any>(null)
  const [pendingUpload, setPendingUpload] = useState(false)
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false)

  // Field mapping state
  const [showFieldMapping, setShowFieldMapping] = useState(false)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [mappingConfirmed, setMappingConfirmed] = useState(false)

  // Delete portfolio state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [jobToDelete, setJobToDelete] = useState<ImportJob | null>(null)

  // Delete import job state
  const [showDeleteJobConfirm, setShowDeleteJobConfirm] = useState(false)
  const [jobToDeleteJob, setJobToDeleteJob] = useState<ImportJob | null>(null)
  const [showDeleteJobModal, setShowDeleteJobModal] = useState(false)

  // Auto-refresh state
  const [hasProcessingJobs, setHasProcessingJobs] = useState(false)
  
  // Validation state
  const [validationResults, setValidationResults] = useState<any>(null)
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    fetchJobs()
    fetchTemplates()
    fetchPortfolios()
  }, [])

  // Auto-refresh effect for processing jobs
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    let retryCount = 0
    const maxRetries = 3

    if (hasProcessingJobs) {
      console.log('Starting auto-refresh for processing jobs')
      
      const pollJobs = async () => {
        try {
          await fetchJobs()
          retryCount = 0 // Reset retry count on success
        } catch (error) {
          retryCount++
          console.warn(`Polling attempt ${retryCount} failed:`, error)
          
          if (retryCount >= maxRetries) {
            console.error('Max retries reached, stopping auto-refresh')
            setHasProcessingJobs(false)
            return
          }
        }
      }

      // Initial poll
      pollJobs()
      
      // Set up interval with exponential backoff
      intervalId = setInterval(() => {
        pollJobs()
      }, 10000) // Refresh every 10 seconds instead of 3
    }

    return () => {
      if (intervalId) {
        console.log('Stopping auto-refresh')
        clearInterval(intervalId)
      }
    }
  }, [hasProcessingJobs])

  // Check for active jobs whenever jobs state changes
  useEffect(() => {
    const activeJobs = jobs.filter(job => 
      job.status === 'processing' || job.status === 'pending' || job.status === 'validated'
    )
    const shouldRefresh = activeJobs.length > 0
    
    if (shouldRefresh !== hasProcessingJobs) {
      setHasProcessingJobs(shouldRefresh)
    }
  }, [jobs, hasProcessingJobs])

  // Poll for updates when validation is running
  useEffect(() => {
    const validatingJob = jobs.find(job => job.status === 'validating')
    
    if (validatingJob) {
      const interval = setInterval(() => {
        fetchJobs()
      }, 2000) // Poll every 2 seconds during validation
      
      return () => clearInterval(interval)
    }
  }, [jobs])

  // Auto-refresh jobs for active import jobs
  useEffect(() => {
    const activeJobs = jobs.filter(job => 
      ['processing', 'pending', 'validating'].includes(job.status)
    )
    
    if (activeJobs.length > 0) {
      const interval = setInterval(() => {
        fetchJobs()
      }, 5000) // Poll every 5 seconds for active jobs
      
      return () => clearInterval(interval)
    }
  }, [jobs])

  const fetchJobs = async () => {
    try {
      const response = await authenticatedFetch('/api/import')
      
      // Handle rate limiting
      if (response.status === 429) {
        console.warn('Rate limited, will retry later')
        throw new Error('Rate limited')
      }
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        console.warn('Authentication error, stopping auto-refresh')
        setHasProcessingJobs(false)
        throw new Error('Authentication failed')
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Error fetching jobs:', error)
      throw error // Re-throw to let the polling logic handle it
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await authenticatedFetch('/api/import/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchPortfolios = async () => {
    try {
      const response = await authenticatedFetch('/api/portfolios')
      const data = await response.json()
      
      // Handle both array and object responses
      if (Array.isArray(data)) {
        setPortfolios(data)
      } else if (data.portfolios) {
        setPortfolios(data.portfolios)
      } else {
        setPortfolios([])
      }
    } catch (error) {
      console.error('Error fetching portfolios:', error)
      setPortfolios([])
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreview(null)
      setShowPreview(false)
      // Reset portfolio selection when file changes
      setSelectedPortfolioId(null)
      setNewPortfolio(null)
    }
  }

  const handlePreview = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('import_type', importType)
      if (selectedTemplate) {
        formData.append('template_id', selectedTemplate)
      }

      const response = await authenticatedFetch('/api/import/preview', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (data.preview) {
        setPreview(data.preview)
        setShowPreview(true)
      }
    } catch (error) {
      console.error('Error generating preview:', error)
    } finally {
      setIsUploading(false)
    }
  }

  // Required/optional fields for each import type - Focused on Debt Collection
  const requiredFieldsByType: Record<string, string[]> = {
    accounts: [
      'original_account_number',  // Core debt identifier
      'ssn',                     // Social Security Number
      'current_balance',         // Current outstanding amount
      'charge_off_date'          // When debt was charged off
    ],
    portfolios: ['name', 'client_code', 'original_balance', 'account_count'],
    clients: ['name', 'code'],
    agencies: ['name', 'code', 'instance_id', 'contact_email']
  }
  const optionalFieldsByType: Record<string, string[]> = {
    accounts: [
      // Core Debt Information (Optional but commonly used)
      'account_number',          // Current account number
      'original_loan_date',      // When account was opened
      
      // Additional Debt Information
      'date_opened',             // When account was opened
      'last_payment_date',       // Last payment received
      'last_payment_amount',     // Amount of last payment
      'interest_rate',           // Interest rate on debt
      'late_fees',              // Late fees accrued
      'collection_fees',        // Collection fees
      'debt_age',               // Age of debt in days
      'last_activity_date',     // Last activity on account
      'original_creditor',       // Original creditor name
      
      // Bank Information (for payday loans, etc.)
      'original_bank_name',      // Original bank name
      'original_bank_routing_number', // Bank routing number
      'original_bank_account_number', // Bank account number
      'original_bank_account_type',   // Account type (checking/savings)
      'original_bank_account_holder', // Account holder name
      
      // Additional Debtor Information
      'first_name',             // First name
      'last_name',              // Last name
      'middle_name',            // Middle name
      'name_prefix',            // Title (Mr., Ms., etc.)
      'name_suffix',            // Suffix (Jr., Sr., etc.)
      'dob',                    // Date of birth
      'address_line1',          // Primary address
      'address_line2',          // Apartment/unit number
      'city',                   // City
      'state',                  // State
      'zipcode',                // ZIP code
      'county',                 // County for legal purposes
      'country',                // Country (defaults to US)
      
      // Contact Information
      'phone_primary',          // Primary phone number
      'phone_secondary',        // Secondary phone number
      'phone_work',             // Work phone number
      'email_primary',          // Primary email address
      'email_secondary',        // Secondary email address
      
      // Employment Information
      'occupation',             // Job title
      'employer',               // Employer name
      'annual_income',          // Annual income
      
      // Compliance and Legal
      'do_not_call',            // Do not call flag
      'do_not_mail',            // Do not mail flag
      'do_not_email',           // Do not email flag
      'do_not_text',            // Do not text flag
      'bankruptcy_filed',       // Bankruptcy status
      'active_military',        // Military status
      'hardship_declared',      // Hardship declaration
      'hardship_type',          // Type of hardship
      
      // Portfolio and Client
      'portfolio_name',         // Portfolio assignment
      'client_name'             // Client/creditor name
    ],
    portfolios: ['description', 'portfolio_type', 'charge_off_date', 'debt_age_months', 'average_balance', 'geographic_focus', 'credit_score_range', 'status'],
    clients: ['contact_name', 'contact_email', 'contact_phone', 'address', 'city', 'state', 'zipcode', 'client_type', 'status'],
    agencies: ['contact_name', 'contact_phone', 'address', 'city', 'state', 'zipcode', 'subscription_tier', 'subscription_status', 'status']
  }

  // Show field mapping modal after preview
  // useEffect(() => {
  //   if (showPreview && preview && preview.headers && preview.headers.length > 0) {
  //     setShowFieldMapping(true)
  //     setMappingConfirmed(false)
  //   }
  // }, [showPreview, preview])

  const handleFieldMappingConfirm = (mapping: Record<string, string>, templateId?: string) => {
    setFieldMapping(mapping)
    setShowFieldMapping(false)
    setMappingConfirmed(true)
    // Store the selected template ID for the upload
    if (templateId) {
      setSelectedTemplate(templateId)
    }
  }

  const handleMappingUpdate = (mapping: Record<string, string>) => {
    setFieldMapping(mapping)
    setMappingConfirmed(true)
  }

  const handleSaveTemplate = async (template: any) => {
    try {
      const response = await fetch('/api/import/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(template)
      })

      if (response.ok) {
        // Refresh templates
        fetchTemplates()
      } else {
        console.error('Failed to save template')
      }
    } catch (error) {
      console.error('Error saving template:', error)
    }
  }

  const handleUpdateTemplate = async (templateId: string, template: any) => {
    try {
      const response = await fetch(`/api/import/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(template)
      })

      if (response.ok) {
        // Refresh templates
        fetchTemplates()
      } else {
        console.error('Failed to update template')
      }
    } catch (error) {
      console.error('Error updating template:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/import/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })

      if (response.ok) {
        // Refresh templates
        fetchTemplates()
      } else {
        console.error('Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    if (!mappingConfirmed) {
      setShowFieldMapping(true)
      return
    }

    // For account imports, check if portfolio selection is needed
    if (importType === 'accounts' && !selectedPortfolioId && !newPortfolio) {
      setPendingUpload(true)
      return
    }

    // Proceed with upload
    await performUpload()
  }

  const performUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('import_type', importType)
      if (selectedTemplate) {
        formData.append('template_id', selectedTemplate)
      }
      
      // Add portfolio information for account imports
      if (importType === 'accounts') {
        if (selectedPortfolioId) {
          formData.append('portfolio_id', selectedPortfolioId)
        } else if (newPortfolio) {
          formData.append('new_portfolio', JSON.stringify(newPortfolio))
        }
      }

      // Add field mapping
      formData.append('field_mapping', JSON.stringify(fieldMapping))

      console.log('🔍 [FRONTEND] About to call authenticatedFetch with:', {
        url: '/api/import',
        method: 'POST',
        bodyType: formData instanceof FormData ? 'FormData' : typeof formData,
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => [key, typeof value])
      })

      const response = await authenticatedFetch('/api/import', {
        method: 'POST',
        body: formData
      })

      console.log('🔍 [FRONTEND] authenticatedFetch response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Upload successful:', data)
        
        // Reset form
        setSelectedFile(null)
        setPreview(null)
        setShowPreview(false)
        setSelectedPortfolioId(null)
        setNewPortfolio(null)
        setPendingUpload(false)
        
        // Refresh jobs list
        fetchJobs()
      } else {
        console.error('Upload failed')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handlePortfolioCreated = (portfolio: any) => {
    // Refresh the portfolios list
    fetchPortfolios()
    // Select the newly created portfolio
    setSelectedPortfolioId(portfolio.id)
    setNewPortfolio(null)
    setIsPortfolioModalOpen(false)
    
    if (pendingUpload) {
      performUpload()
    }
  }

  const handleDeletePortfolio = (job: ImportJob) => {
    setJobToDelete(job)
    setShowDeleteConfirm(true)
  }

  const handleDeleteImportJob = (job: ImportJob) => {
    setJobToDeleteJob(job)
    setShowDeleteJobConfirm(true)
  }

  const handleCancelImportJob = async (job: ImportJob) => {
    try {
      const response = await authenticatedFetch(`/api/import/cancel?job_id=${job.id}`, {
        method: 'POST'
      })

      if (response.ok) {
        // Refresh the jobs list
        fetchJobs()
        toast.success('Import job cancelled successfully')
      } else {
        const errorData = await response.json()
        toast.error(`Failed to cancel import job: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error cancelling import job:', error)
      toast.error('An error occurred while cancelling the import job')
    }
  }

  const downloadFailedRows = async (jobId: string) => {
    try {
      const response = await authenticatedFetch(`/api/import/failed-rows/${jobId}`)

      if (!response.ok) {
        throw new Error(`Failed to download failed rows: ${response.statusText}`)
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || `failed_rows_${jobId}.csv`

      // Create a blob and download it
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Failed rows CSV downloaded successfully')
    } catch (error) {
      console.error('Error downloading failed rows:', error)
      toast.error('Failed to download failed rows CSV')
    }
  }

  const handleConfirmDeletePortfolio = async () => {
    if (!jobToDelete) return

    try {
      const response = await authenticatedFetch(`/api/import?job_id=${jobToDelete.id}&file_name=${encodeURIComponent(jobToDelete.file_name)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh the jobs list
        fetchJobs()
        setShowDeleteConfirm(false)
        setJobToDelete(null)
      } else {
        const errorData = await response.json()
        alert(`Failed to delete portfolio: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error deleting portfolio:', error)
      alert('An error occurred while deleting the portfolio')
    }
  }

  const handleConfirmDeleteImportJob = async () => {
    if (!jobToDeleteJob) return

    try {
      const response = await authenticatedFetch(`/api/import?job_id=${jobToDeleteJob.id}&file_name=${encodeURIComponent(jobToDeleteJob.file_name)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh the jobs list
        fetchJobs()
        setShowDeleteJobConfirm(false)
        setJobToDeleteJob(null)
        toast.success('Import job deleted successfully')
      } else {
        const errorData = await response.json()
        toast.error(`Failed to delete import job: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error deleting import job:', error)
      toast.error('An error occurred while deleting the import job')
    }
  }

  // Validation functions
  const handleValidate = async (jobId: string) => {
    try {
      setIsValidating(true)
      console.log(`🔍 Starting validation for job: ${jobId}`)
      
      const response = await authenticatedFetch('/api/import/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId })
      })
      
      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('✅ Validation completed:', data)
      
      setValidationResults(data.validationResults)
      
      // Refresh jobs to get updated validation status
      await fetchJobs()
      
      toast.success(`Validation completed: ${data.validationResults.validRows} valid, ${data.validationResults.invalidRows} invalid rows`)
      
    } catch (error) {
      console.error('❌ Validation failed:', error)
      toast.error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsValidating(false)
    }
  }

  const handleProcess = async (jobId: string) => {
    try {
      console.log(`🚀 Starting processing for job: ${jobId}`)
      
      // Find the job to show initial info
      const job = jobs.find(j => j.id === jobId)
      if (job) {
        toast.info(`Processing started for ${job.file_name} (${job.import_type})...`, {
          autoClose: false,
          toastId: `processing-${jobId}`
        })
      }
      
      // Process data in chunks to avoid Vercel timeout
      let startIndex = 0
      const chunkSize = 100
      let totalProcessed = 0
      let allErrors: string[] = []
      let isCompleted = false
      
      while (!isCompleted) {
        console.log(`📊 Processing chunk: ${startIndex + 1}-${startIndex + chunkSize}`)
        
        // Call the processing API with chunk parameters
        const response = await authenticatedFetch('/api/import/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            jobId, 
            chunkSize, 
            startIndex 
          }),
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Processing failed')
        }
        
        const result = await response.json()
        console.log(`📊 Chunk completed:`, result)
        
        // Accumulate results
        totalProcessed += result.processedCount || 0
        if (result.errors && result.errors.length > 0) {
          allErrors = allErrors.concat(result.errors)
        }
        
        // Update progress toast
        if (job) {
          toast.info(`Processing ${job.file_name}: ${result.progress || 0}% complete (${totalProcessed} rows processed)`, {
            autoClose: false,
            toastId: `processing-${jobId}`
          })
        }
        
        // Check if processing is complete
        if (result.completed) {
          isCompleted = true
          console.log('✅ Processing completed:', result)
        } else {
          // Move to next chunk
          startIndex = result.nextStartIndex || (startIndex + chunkSize)
          
          // Small delay between chunks to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      // Dismiss the processing toast
      toast.dismiss(`processing-${jobId}`)
      
      if (allErrors.length > 0) {
        toast.warning(`Processing completed with ${allErrors.length} errors. ${totalProcessed} rows processed.`)
      } else {
        toast.success(`Processing completed successfully! ${totalProcessed} rows processed.`)
      }
      
      // Refresh the import jobs to show updated status
      fetchJobs()
      
    } catch (error) {
      console.error('❌ Processing failed:', error)
      
      // Dismiss the processing toast on error
      const job = jobs.find(j => j.id === jobId)
      if (job) {
        toast.dismiss(`processing-${jobId}`)
      }
      
      toast.error(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId)

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader title="File Import" />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
              {/* Admin Link for Platform Admins */}
              {isPlatformAdmin && (
                <div className="mb-4 flex justify-end">
                  <Link
                    href="/admin/imports"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    Manage Imports
                  </Link>
                </div>
              )}
              
              {/* Upload Section */}
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload File</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* File Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select File
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <input
                          id="file-input"
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <label
                          htmlFor="file-input"
                          className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                        >
                          Choose File
                        </label>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {selectedFile ? selectedFile.name : 'CSV or Excel files only'}
                      </p>
                      {selectedFile && (
                        <p className="mt-1 text-xs text-gray-400">
                          Size: {formatFileSize(selectedFile.size)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Import Configuration */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Import Type
                      </label>
                      <select
                        value={importType}
                        onChange={(e) => {
                          setImportType(e.target.value)
                          // Reset portfolio selection when import type changes
                          setSelectedPortfolioId(null)
                          setNewPortfolio(null)
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="accounts">Debt Accounts</option>
                        <option value="skip_trace">Skip Trace</option>
                        <option value="portfolios">Portfolios</option>
                        <option value="clients">Clients</option>
                        <option value="agencies">Agencies</option>
                      </select>
                    </div>

                    {/* Portfolio Selection for Account Imports */}
                    {importType === 'accounts' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Portfolio Assignment
                          </label>
                          <button
                            onClick={() => setIsPortfolioModalOpen(true)}
                            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                          >
                            <PlusIcon className="h-4 w-4 mr-1" />
                            Create New
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <select
                              value={selectedPortfolioId || ''}
                              onChange={(e) => setSelectedPortfolioId(e.target.value || null)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Choose a portfolio...</option>
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

                          {newPortfolio && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <p className="text-sm text-blue-800">
                                ✅ New portfolio will be created: {newPortfolio.name}
                              </p>
                              <button
                                onClick={() => {
                                  setSelectedPortfolioId(null)
                                  setNewPortfolio(null)
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Change selection
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handlePreview}
                    disabled={!selectedFile || isUploading}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Processing...' : 'Validate'}
                  </button>
                  {preview && (
                    <button
                      onClick={() => setShowFieldMapping(true)}
                      disabled={isUploading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Map Fields
                    </button>
                  )}
                  {preview && mappingConfirmed && (
                    <button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>

              {/* Preview Section */}
              {showPreview && preview && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">File Preview</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-900">{preview.file_type?.toUpperCase() || 'UNKNOWN'}</p>
                      <p className="text-sm text-blue-700">File Type</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-900">{preview.total_rows}</p>
                      <p className="text-sm text-green-700">Total Rows</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-900">{preview.validation_errors?.length || 0}</p>
                      <p className="text-sm text-yellow-700">Validation Errors</p>
                    </div>
                  </div>

                  {preview.validation_errors && preview.validation_errors.length > 0 && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                      <h3 className="font-medium text-red-900 mb-2">Validation Errors:</h3>
                      <ul className="text-sm text-red-700 space-y-1">
                        {preview.validation_errors.map((error: string, index: number) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {preview.headers?.map(header => (
                            <th key={header} className="text-left py-2 px-2 font-medium text-gray-700">
                              {header}
                            </th>
                          )) || []}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample_rows?.map((row, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            {preview.headers?.map(header => (
                              <td key={header} className="py-2 px-2 text-gray-600">
                                {String(row[header] || '')}
                              </td>
                            )) || []}
                          </tr>
                        )) || []}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Jobs Section */}
              {jobs.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">Import Jobs</h2>
                      {hasProcessingJobs && (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-600 font-medium">Auto-refreshing...</span>
                        </div>
                      )}
                      <button
                        onClick={fetchJobs}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Refresh jobs list"
                      >
                        <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>
                    
                    {/* Real-time processing status */}
                    {(() => {
                      const activeJobs = jobs.filter(job => job.status === 'processing' || job.status === 'validated')
                      if (activeJobs.length > 0) {
                        return (
                          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex items-center space-x-2 mb-2">
                              <DocumentArrowUpIcon className="h-5 w-5 text-blue-600 animate-pulse" />
                              <h3 className="font-medium text-blue-900">Active Import Jobs</h3>
                            </div>
                            <div className="space-y-2">
                              {activeJobs.map(job => (
                                <div key={job.id} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-blue-900">{job.file_name}</span>
                                    <span className="text-xs text-blue-600">({job.import_type})</span>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm text-blue-700">Progress:</span>
                                      <span className="text-sm font-medium text-blue-900">{job.progress || 0}%</span>
                                    </div>
                                    {job.status === 'processing' && job.processed_rows && job.total_rows && (
                                      <div className="text-sm text-blue-700">
                                        {job.processed_rows} / {job.total_rows} rows
                                      </div>
                                    )}
                                    {job.status === 'validated' && job.validation_results && (
                                      <div className="text-sm text-blue-700">
                                        {job.validation_results.validRows} valid rows ready
                                      </div>
                                    )}
                                    {job.status === 'processing' && job.started_at && (
                                      <div className="text-xs text-blue-600">
                                        Started: {new Date(job.started_at).toLocaleTimeString()}
                                      </div>
                                    )}
                                    {job.status === 'validated' && job.validation_completed_at && (
                                      <div className="text-xs text-blue-600">
                                        Validated: {new Date(job.validation_completed_at).toLocaleTimeString()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            File
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Progress
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Results
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          {isPlatformAdmin && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {jobs.map((job) => (
                          <tr key={job.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{job.file_name}</div>
                              <div className="text-sm text-gray-500">{formatFileSize(job.file_size)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {job.import_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center">
                                  {getStatusIcon(job.status)}
                                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                    {job.status}
                                  </span>
                                </div>
                                {job.status === 'processing' && job.started_at && (
                                  <div className="text-xs text-gray-500">
                                    Started: {new Date(job.started_at).toLocaleTimeString()}
                                  </div>
                                )}
                                {job.status === 'completed' && job.processing_completed_at && (
                                  <div className="text-xs text-gray-500">
                                    Completed: {new Date(job.processing_completed_at).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{job.progress || 0}%</span>
                                  {job.status === 'processing' && (
                                    <span className="text-xs text-blue-600 animate-pulse">Processing...</span>
                                  )}
                                  {job.status === 'validated' && (
                                    <span className="text-xs text-blue-600">Ready to Process</span>
                                  )}
                                  {job.status === 'processing' && (
                                    <span className="text-xs text-blue-600 animate-pulse">Processing...</span>
                                  )}
                                </div>
                                {(job.status === 'processing' || job.status === 'validated') && (
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                      style={{ width: `${job.progress || 0}%` }}
                                    ></div>
                                  </div>
                                )}
                                {job.status === 'processing' && job.processed_rows && job.total_rows && (
                                  <div className="text-xs text-gray-500">
                                    {job.processed_rows} / {job.total_rows} rows processed
                                  </div>
                                )}
                                {job.status === 'validated' && job.validation_results && (
                                  <div className="text-xs text-gray-500">
                                    {job.validation_results.validRows} valid rows ready
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {job.status === 'completed' ? (
                                <>
                                  {job.processed_rows || 0} / {job.total_rows || 0}
                                  {job.processing_errors && job.processing_errors.length > 0 && (
                                    <span className="text-red-600 ml-2">({job.processing_errors.length} errors)</span>
                                  )}
                                </>
                              ) : job.status === 'validated' ? (
                                <>
                                  {job.validation_results?.validRows || 0} valid rows
                                  {job.validation_results?.invalidRows > 0 && (
                                    <span className="text-red-600 ml-2">({job.validation_results.invalidRows} invalid)</span>
                                  )}
                                </>
              ) : job.status === 'uploaded' ? (
                'Ready for validation'
              ) : (
                'Pending'
              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A'}
                            </td>
                            {isPlatformAdmin && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex flex-col space-y-1">
                                  {job.status === 'completed' && job.portfolio_id && (
                                    <button
                                      onClick={() => handleDeletePortfolio(job)}
                                      className="inline-flex items-center px-2 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                      title="Delete portfolio created by this import"
                                    >
                                      <TrashIcon className="h-3 w-3 mr-1" />
                                      Delete Portfolio
                                    </button>
                                  )}
                                  {job.status === 'processing' && (
                                    <button
                                      onClick={() => handleCancelImportJob(job)}
                                      className="inline-flex items-center px-2 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                      title="Cancel import job"
                                    >
                                      <XCircleIcon className="h-3 w-3 mr-1" />
                                      Cancel Job
                                    </button>
                                  )}
                                  {job.failed_rows && job.failed_rows > 0 && job.failed_rows_csv_path && (
                                    <button
                                      onClick={() => downloadFailedRows(job.id)}
                                      className="inline-flex items-center px-2 py-1 border border-blue-300 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                      title="Download failed rows CSV"
                                    >
                                      <DocumentArrowUpIcon className="h-3 w-3 mr-1" />
                                      Download Failed Rows
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteImportJob(job)}
                                    className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                                    title="Delete import job"
                                  >
                                    <TrashIcon className="h-3 w-3 mr-1" />
                                    Delete Job
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Validation Section */}
              {jobs.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Validation</h2>
                  
                  {/* Show validation for the most recent uploaded, validating, or validated job */}
                  {(() => {
                    const latestValidationJob = jobs
                      .filter(job => (job.status === 'uploaded' || job.status === 'validating' || job.status === 'validated') && job.created_at)
                      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())[0]
                    
                    if (latestValidationJob) {
                      return (
                        <ImportValidationResults
                          jobId={latestValidationJob.id}
                          validationResults={validationResults}
                          onValidate={handleValidate}
                          onProcess={handleProcess}
                          jobStatus={latestValidationJob.status}
                          jobProgress={latestValidationJob.progress}
                        />
                      )
                    }
                    
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <p>Upload a file to enable data validation</p>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Portfolio Creation Modal */}
      <PortfolioModal
        isOpen={isPortfolioModalOpen}
        onClose={() => setIsPortfolioModalOpen(false)}
        onPortfolioSaved={handlePortfolioCreated}
      />

      {/* Field Mapping Modal */}
      <FieldMappingModal
        isOpen={showFieldMapping}
        onClose={() => setShowFieldMapping(false)}
        onConfirm={handleFieldMappingConfirm}
        onMappingUpdate={handleMappingUpdate}
        headers={preview?.headers || []}
        requiredFields={requiredFieldsByType[importType] || []}
        optionalFields={optionalFieldsByType[importType] || []}
        initialMapping={fieldMapping}
        importType={importType}
        templates={templates}
        onSaveTemplate={handleSaveTemplate}
        onUpdateTemplate={handleUpdateTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      {/* Delete Portfolio Confirmation Dialog */}
      <DeletePortfolioConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setJobToDelete(null)
        }}
        onConfirm={handleConfirmDeletePortfolio}
        fileName={jobToDelete?.file_name || ''}
      />

      {/* Delete Import Job Confirmation Dialog */}
      {showDeleteJobConfirm && jobToDeleteJob && (
        <Dialog open={showDeleteJobConfirm} onOpenChange={(open) => {
          if (!open) {
            setShowDeleteJobConfirm(false)
            setJobToDeleteJob(null)
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <ExclamationTriangleIcon className="h-5 w-5" />
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
                  <li>All accounts/debt accounts from this specific import</li>
                  <li>All payment records for these accounts</li>
                  <li>All call logs and notes for these accounts</li>
                  <li>All skip-trace data for these accounts (addresses, phones, relatives, etc.)</li>
                  <li>Person records (only if not used by other accounts)</li>
                  {jobToDeleteJob.portfolio_id && (
                    <li className="font-medium">The portfolio (only if this was the only import for that portfolio)</li>
                  )}
                </ul>
                <p className="text-sm text-blue-700 mt-2 font-medium">
                  <strong>Note:</strong> Person data will be preserved if the same person is associated with other accounts in the system.
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Import Job to Delete:</Label>
                <p className="text-sm text-gray-900 font-medium">{jobToDeleteJob.file_name}</p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteJobConfirm(false)
                    setJobToDeleteJob(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConfirmDeleteImportJob}
                  className="border-red-300 text-red-700 hover:bg-red-50 focus:ring-red-500"
                >
                  Delete Import Job
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
} 