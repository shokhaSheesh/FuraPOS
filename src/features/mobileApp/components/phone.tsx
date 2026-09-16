import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * The pieces every screen of the mobile mock is built from.
 *
 * This is a **mock of a different product** — the driver/fleet phone app, not
 * this back office — kept here so it can be looked at without a second repo.
 * Nothing here reads the store or shares components with the back office on
 * purpose: the two are not the same product and should not drift into each
 * other. Sizes are phone sizes (a 390 px screen), not our desktop scale.
 */

/**
 * The device: a 390 × 844 screen, its own scroll, with the screen's top bar and
 * the tab bar pinned outside it — as on a phone, where neither scrolls away.
 */
export function Phone({
  children,
  header,
  tabBar,
}: {
  children: ReactNode
  header?: ReactNode
  tabBar?: ReactNode
}) {
  return (
    <div className="border-fg/20 bg-surface shadow-card relative h-[844px] w-[390px] shrink-0 overflow-hidden rounded-[2.75rem] border-[10px]">
      <div className="bg-canvas flex h-full flex-col">
        {/* The status-bar strip a phone keeps above the screen's own header. */}
        <div className="bg-surface relative h-7 shrink-0">
          <div className="bg-fg/20 absolute top-2 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full" />
        </div>
        {header}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-4">{children}</div>
        {tabBar}
      </div>
    </div>
  )
}

/** The screen's own top bar: back, title, one action. */
export function PhoneHeader({
  title,
  left,
  right,
}: {
  title: string
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="bg-surface border-border flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <div className="text-fg-muted flex size-8 items-center justify-center">{left}</div>
      <p className="text-fg flex-1 text-center text-[15px] font-semibold">{title}</p>
      <div className="text-fg-muted flex size-8 items-center justify-center">{right}</div>
    </div>
  )
}

export function PhoneCard({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        'bg-surface border-border mx-3 rounded-2xl border',
        padded && 'p-3.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A titled block, with an optional "see all" on the right. */
export function PhoneSection({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-5', className)}>
      {title ? (
        <div className="mb-2 flex items-end justify-between gap-2 px-4">
          <div>
            <h2 className="text-fg text-[15px] font-semibold">{title}</h2>
            {subtitle ? <p className="text-fg-subtle text-[11px]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** The pill row used for periods and expense types. Scrolls sideways, as on a phone. */
export function PhoneChips<T extends string>({
  options,
  value,
  ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  ariaLabel: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex scrollbar-none gap-1.5 overflow-x-auto px-4 pb-0.5"
    >
      {options.map((option) => (
        <span
          key={option.value}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap',
            option.value === value
              ? 'bg-fg text-surface'
              : 'bg-surface border-border text-fg-muted border',
          )}
        >
          {option.label}
        </span>
      ))}
    </div>
  )
}

export function PhoneRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-border flex items-center gap-3 px-3.5 py-3', className)}>
      {children}
    </div>
  )
}

/** A soft round icon tile — the quick actions and the transaction list use it. */
export function IconTile({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}) {
  const tones = {
    neutral: 'bg-surface-muted text-fg-muted',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-primary-soft text-primary',
  }
  return (
    <span
      className={cn(
        'grid place-items-center rounded-full',
        size === 'sm' ? 'size-9' : 'size-12',
        tones[tone],
      )}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} />
    </span>
  )
}
