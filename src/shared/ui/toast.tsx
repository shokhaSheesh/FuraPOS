import { useEffect } from 'react'
import { create } from 'zustand'
import { Check, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { Button } from './Button'

type ToastTone = 'success' | 'danger' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  message: string
  undo?: () => void
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 0

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => set((state) => ({ toasts: [...state.toasts, { ...toast, id: ++nextId }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/**
 * Confirms writes. Blocking errors belong in the form, not here
 * (docs/DESIGN_RULES.md § 8.2).
 */
export const toast = {
  success: (message: string, undo?: () => void) =>
    useToastStore.getState().push({ tone: 'success', message, undo }),
  error: (message: string) => useToastStore.getState().push({ tone: 'danger', message }),
  info: (message: string) => useToastStore.getState().push({ tone: 'info', message }),
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-100 flex flex-col gap-2">
      {toasts.map((item) => (
        <ToastRow key={item.id} toast={item} />
      ))}
    </div>
  )
}

const toneClasses: Record<ToastTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  info: 'text-info',
}

function ToastRow({ toast: item }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), 4000)
    return () => clearTimeout(timer)
  }, [item.id, dismiss])

  const Icon = item.tone === 'danger' ? TriangleAlert : Check

  return (
    <div
      role="status"
      className="rounded-control border-border bg-surface shadow-popover pointer-events-auto flex max-w-96 min-w-72 items-center gap-2.5 border px-3 py-2.5"
    >
      <Icon className={cn('size-4 shrink-0', toneClasses[item.tone])} />
      <p className="text-fg flex-1 text-sm">{item.message}</p>
      {item.undo ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          onClick={() => {
            item.undo?.()
            dismiss(item.id)
          }}
        >
          Undo
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label="Dismiss"
        onClick={() => dismiss(item.id)}
      >
        <X />
      </Button>
    </div>
  )
}
