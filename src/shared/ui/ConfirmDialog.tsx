import type { ReactNode } from 'react'
import { Modal } from './Modal'

/**
 * The only way a destructive action happens. A list row never deletes on click
 * — it opens this, and the row disappears only once the server confirms
 * (docs/DESIGN_RULES.md § 4.2, § 9.4).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  /** Name the thing being deleted — "Delete Oil filter A12?" not "Are you sure?" */
  body,
  confirmLabel = 'Delete',
  destructive = true,
  submitting,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: ReactNode
  confirmLabel?: string
  destructive?: boolean
  submitting?: boolean
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      submitting={submitting}
      primary={{
        label: confirmLabel,
        variant: destructive ? 'danger' : 'primary',
        onClick: onConfirm,
      }}
    >
      <p className="text-fg-muted text-sm">{body}</p>
    </Modal>
  )
}
