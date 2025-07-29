'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface DeletePortfolioConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  fileName: string
  portfolioName?: string
}

export default function DeletePortfolioConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  portfolioName
}: DeletePortfolioConfirmDialogProps) {
  const [confirmFileName, setConfirmFileName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    if (confirmFileName !== fileName) {
      return
    }

    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Error deleting portfolio:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    setConfirmFileName('')
    setIsDeleting(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Delete Import & Portfolio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This action cannot be undone. This will permanently delete:
            </p>
            <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
              <li>The import job and file</li>
              <li>The entire portfolio</li>
              <li>All accounts/debtors in the portfolio</li>
              <li>All payment records</li>
              <li>All call logs and notes</li>
              <li>All skip-trace data (addresses, phones, relatives, etc.)</li>
              <li>All person records (if not used by other portfolios)</li>
            </ul>
          </div>

          {portfolioName && (
            <div>
              <Label className="text-sm font-medium text-gray-700">Portfolio to Delete:</Label>
              <p className="text-sm text-gray-900 font-medium">{portfolioName}</p>
            </div>
          )}

          <div>
            <Label htmlFor="confirm-filename" className="text-sm font-medium text-gray-700">
              To confirm deletion, please type the exact file name:
            </Label>
            <p className="text-xs text-gray-500 mb-2">"{fileName}"</p>
            <Input
              id="confirm-filename"
              value={confirmFileName}
              onChange={(e) => setConfirmFileName(e.target.value)}
              placeholder="Enter file name to confirm"
              className={confirmFileName !== fileName && confirmFileName.length > 0 ? 'border-red-300' : ''}
            />
            {confirmFileName !== fileName && confirmFileName.length > 0 && (
              <p className="text-xs text-red-600 mt-1">File name does not match</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleConfirm}
              disabled={confirmFileName !== fileName || isDeleting}
              className="border-red-300 text-red-700 hover:bg-red-50 focus:ring-red-500"
            >
              {isDeleting ? 'Deleting...' : 'Delete Import & Portfolio'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 