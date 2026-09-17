import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'

/**
 * A whole screen opened over another one — for when the thing being done is
 * a full page in its own right (creating a product) but leaving the current
 * page would lose work in progress (a half-built order).
 *
 * The page underneath stays mounted, so closing this returns to it exactly as
 * it was. The content carries its own header and buttons, just as the page
 * version does, so the two look and behave the same.
 */
export function FullScreenDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** For screen readers; the content shows its own visible title. */
  title: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          // Escape would throw away a half-filled product form; Cancel is explicit.
          onEscapeKeyDown={(event) => event.preventDefault()}
          className="bg-canvas fixed inset-0 z-50 overflow-y-auto outline-none"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <div className="w-full px-6 py-5 2xl:px-8">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
