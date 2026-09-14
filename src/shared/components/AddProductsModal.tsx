import type { ReactNode } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'

/**
 * Picking products for a document, opened from "Add products".
 *
 * Stays open while rows are added — a delivery is a dozen lines, not one — and
 * says how many are on the document so far, so "Done" is a decision rather
 * than a guess. The browser inside is the page's own: our catalogue, or a
 * supplier's.
 */
export function AddProductsModal({
  open,
  onOpenChange,
  title = 'Add products',
  description,
  lineCount,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  lineCount: number
  children: ReactNode
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="lg"
      footer={
        <footer className="border-border flex items-center justify-between gap-3 border-t p-4">
          <span className="text-fg-muted text-sm">
            {formatNumber(lineCount)} {lineCount === 1 ? 'line' : 'lines'} on the document
          </span>
          <Button type="button" variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </footer>
      }
    >
      {children}
    </Modal>
  )
}
