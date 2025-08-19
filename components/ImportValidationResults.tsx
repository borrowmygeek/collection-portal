'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ValidationResults {
  totalRows: number
  validRows: number
  invalidRows: number
  errors: string[]
  warnings: string[]
  rowDetails: Array<{
    rowNumber: number
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>
}

interface ImportValidationResultsProps {
  jobId: string
  validationResults: ValidationResults | null
  onValidate: (jobId: string) => Promise<void>
  onProcess: (jobId: string) => Promise<void>
  jobStatus?: string
  jobProgress?: number | null
}

export default function ImportValidationResults({
  jobId,
  validationResults,
  onValidate,
  onProcess,
  jobStatus,
  jobProgress
}: ImportValidationResultsProps) {
  const [isValidating, setIsValidating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Check if validation is currently running
  const isValidationRunning = jobStatus === 'validating'

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      await onValidate(jobId)
    } finally {
      setIsValidating(false)
    }
  }

  const handleProcess = async () => {
    setIsProcessing(true)
    try {
      await onProcess(jobId)
    } finally {
      setIsProcessing(false)
    }
  }

  // Show validation in progress
  if (isValidationRunning) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Data Validation</span>
            <Badge variant="outline" className="animate-pulse">Validating...</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Validating your data...</p>
            </div>
            
            {/* Progress Bar */}
            {jobProgress !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress</span>
                  <span>{jobProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${jobProgress}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  {jobProgress! < 30 && "Fetching data..."}
                  {jobProgress! >= 30 && jobProgress! < 60 && "Analyzing data..."}
                  {jobProgress! >= 60 && jobProgress! < 90 && "Running validation rules..."}
                  {jobProgress! >= 90 && "Finalizing results..."}
                </div>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground text-center">
              This may take a few minutes for large files. Please don't close this page.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!validationResults) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Data Validation</span>
            <Badge variant="outline">Not Started</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Run validation to check data quality before processing.
          </p>
          <Button 
            onClick={handleValidate} 
            disabled={isValidating}
            className="w-full"
          >
            {isValidating ? 'Validating...' : 'Start Validation'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const errorRate = validationResults.totalRows > 0 
    ? ((validationResults.invalidRows / validationResults.totalRows) * 100).toFixed(1)
    : '0'

  const warningRate = validationResults.totalRows > 0
    ? ((validationResults.warnings.length / validationResults.totalRows) * 100).toFixed(1)
    : '0'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Data Validation Results</span>
          <Badge variant={validationResults.invalidRows === 0 ? "default" : "destructive"}>
            {validationResults.invalidRows === 0 ? 'Passed' : 'Issues Found'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{validationResults.totalRows}</div>
            <div className="text-sm text-muted-foreground">Total Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{validationResults.validRows}</div>
            <div className="text-sm text-muted-foreground">Valid Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{validationResults.invalidRows}</div>
            <div className="text-sm text-muted-foreground">Invalid Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{validationResults.warnings.length}</div>
            <div className="text-sm text-muted-foreground">Warnings</div>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Data Quality Score</span>
            <span className="text-sm font-bold">
              {validationResults.totalRows > 0 
                ? ((validationResults.validRows / validationResults.totalRows) * 100).toFixed(1)
                : '0'}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${validationResults.totalRows > 0 
                  ? (validationResults.validRows / validationResults.totalRows) * 100 
                  : 0}%` 
              }}
            />
          </div>
        </div>

        {/* Error & Warning Summary */}
        {validationResults.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-700">Common Errors ({validationResults.errors.length})</h4>
            <div className="space-y-1">
              {validationResults.errors.slice(0, 3).map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                  {error}
                </div>
              ))}
              {validationResults.errors.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  +{validationResults.errors.length - 3} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {validationResults.warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-yellow-700">Common Warnings ({validationResults.warnings.length})</h4>
            <div className="space-y-1">
              {validationResults.warnings.slice(0, 3).map((warning, index) => (
                <div key={index} className="text-sm text-yellow-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                  {warning}
                </div>
              ))}
              {validationResults.warnings.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  +{validationResults.warnings.length - 3} more warnings
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </Button>

          {validationResults.invalidRows === 0 ? (
            <Button 
              onClick={handleProcess} 
              disabled={isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? 'Processing...' : 'Process Valid Data'}
            </Button>
          ) : (
            <Button 
              onClick={handleProcess} 
              disabled={isProcessing}
              variant="outline"
              className="flex-1"
            >
              {isProcessing ? 'Processing...' : 'Process Valid Rows Only'}
            </Button>
          )}
        </div>

        {/* Details Section */}
        {showDetails && (
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Validation Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium mb-2">Rows with Errors</h5>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {validationResults.rowDetails
                    .filter((row) => !row.isValid && row.errors.length > 0)
                    .slice(0, 20)
                    .map((row) => (
                      <div 
                        key={row.rowNumber}
                        className="p-2 rounded border border-red-200 bg-red-50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Row {row.rowNumber}</span>
                          <Badge variant="destructive">Invalid</Badge>
                        </div>
                        <div className="text-sm text-red-600">
                          <strong>Errors:</strong> {row.errors.join(', ')}
                        </div>
                        {row.warnings.length > 0 && (
                          <div className="text-sm text-yellow-600">
                            <strong>Warnings:</strong> {row.warnings.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  {validationResults.rowDetails.filter((row) => !row.isValid && row.errors.length > 0).length === 0 && (
                    <div className="text-sm text-green-600 text-center py-2">
                      No rows with errors found! All rows passed validation.
                    </div>
                  )}
                  {validationResults.rowDetails.filter((row) => !row.isValid && row.errors.length > 0).length > 20 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      Showing first 20 rows with errors. Total: {validationResults.rowDetails.filter((row) => !row.isValid && row.errors.length > 0).length} rows with errors.
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h5 className="font-medium mb-2">Error Analysis</h5>
                <div className="space-y-2">
                  {validationResults.errors.length > 0 ? (
                    <div className="space-y-1">
                      {Array.from(new Set(validationResults.errors)).map((error, index) => (
                        <div key={index} className="text-sm text-red-600">
                          • {error}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-green-600">No errors found!</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {validationResults.invalidRows > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <h4 className="font-medium text-yellow-800 mb-2">Recommendations</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Review and fix {validationResults.invalidRows} invalid rows before processing</li>
              <li>• Consider updating your import template to prevent future validation errors</li>
              <li>• You can still process the {validationResults.validRows} valid rows</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 