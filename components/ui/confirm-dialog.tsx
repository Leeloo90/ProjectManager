'use client'
import { Dialog } from './dialog'
import { Button } from './button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'destructive' | 'default'
  loading?: boolean
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'destructive', loading
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Please wait...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
