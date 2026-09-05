import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { Button, type ButtonProps } from './Button'

const sizes = {
  sm: 'max-w-100', // confirmations
  md: 'max-w-140', // the default form
  lg: 'max-w-190', // a form containing a table
} as const

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: keyof typeof sizes
  /**
   * True while the modal's action is in flight. This is the whole point of the
   * component: while submitting, Esc / backdrop / ✕ are all inert, the footer
   * is disabled, and the spinner sits on the primary button.
   * See docs/DESIGN_RULES.md § 7.4 and § 9.4.
   */
  submitting?: boolean
  children: ReactNode
  primary?: {
    label: string
    onClick?: () => void
    variant?: ButtonProps['variant']
    /** Submits an external <form id="..."> instead of calling onClick. */
    formId?: string
    disabled?: boolean
  }
  secondaryLabel?: string
  /** Replaces the whole footer. Use only when the standard two buttons cannot work. */
  footer?: ReactNode
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  submitting = false,
  children,
  primary,
  secondaryLabel = 'Cancel',
  footer,
}: ModalProps) {
  // A half-closed modal mid-write leaves the user guessing whether it saved,
  // so every dismissal path is blocked until the action resolves.
  const guard = (event: Event) => {
    if (submitting) event.preventDefault()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-chrome/40 backdrop-blur-[1px]" />
        <Dialog.Content
          onEscapeKeyDown={guard}
          onPointerDownOutside={guard}
          onInteractOutside={guard}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-card border border-border bg-surface shadow-modal',
            sizes[size],
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border p-4">
            <div className="space-y-1">
              <Dialog.Title className="text-sm font-semibold text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-fg-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" disabled={submitting}>
                <X />
              </Button>
            </Dialog.Close>
          </header>

          {/* Only the body scrolls — header and footer stay anchored. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

          {footer ?? (
            <footer className="flex items-center justify-end gap-2 border-t border-border p-4">
              <Button
                variant="secondary"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                {secondaryLabel}
              </Button>
              {primary ? (
                <Button
                  variant={primary.variant ?? 'primary'}
                  type={primary.formId ? 'submit' : 'button'}
                  form={primary.formId}
                  onClick={primary.onClick}
                  loading={submitting}
                  disabled={primary.disabled}
                >
                  {primary.label}
                </Button>
              ) : null}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
