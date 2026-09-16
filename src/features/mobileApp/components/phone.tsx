import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { M, TONES, type MobileTone } from './palette'

/**
 * The pieces every screen of the mobile mock is built from.
 *
 * This is a **mock of a different product** — the driver's fleet phone app,
 * not this back office — kept here so it can be looked at without a second
 * repo. It deliberately shares nothing with the back office: its own palette
 * (see palette.ts), its own phone-sized type, and no store. Colours are
 * applied inline from that palette so the mock looks the same whichever theme
 * the surrounding app is in, which is what "1:1 with the design" means.
 */

/** The device: a 390 × 844 screen, its own scroll, top and tab bars pinned. */
export function Phone({
  children,
  header,
  tabBar,
  sheet,
  onDismissSheet,
}: {
  children: ReactNode
  header?: ReactNode
  tabBar?: ReactNode
  /** A bottom sheet over this screen, with the screen dimmed behind it. */
  sheet?: ReactNode
  /** Tapping the dimmed area closes the sheet, as on a phone. */
  onDismissSheet?: () => void
}) {
  return (
    <div
      className="relative h-[844px] w-[390px] shrink-0 overflow-hidden rounded-[2.75rem] border-[10px] shadow-lg"
      style={{ borderColor: M.frame, background: M.card }}
    >
      <div className="flex h-full flex-col" style={{ background: M.screen }}>
        {/* The strip a phone keeps above the screen's own header. */}
        <div className="relative h-7 shrink-0" style={{ background: M.card }}>
          <div
            className="absolute top-2 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full"
            style={{ background: '#D9DDE3' }}
          />
        </div>
        {header}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-4">{children}</div>
        {tabBar}
      </div>
      {sheet ? (
        <div className="absolute inset-0 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Закрыть"
            onClick={onDismissSheet}
            className="absolute inset-0 cursor-default"
            style={{ background: 'rgba(15, 23, 42, 0.45)' }}
          />
          {sheet}
        </div>
      ) : null}
    </div>
  )
}

/**
 * A bottom sheet, as the design has it: a grabber, a title with an optional
 * state badge, scrolling content, and buttons pinned at the bottom.
 */
export function PhoneSheet({
  title,
  badge,
  children,
  footer,
  onClose,
}: {
  title: ReactNode
  badge?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose?: () => void
}) {
  return (
    <div
      className="relative max-h-[86%] overflow-hidden rounded-t-3xl"
      style={{ background: M.card }}
    >
      <div className="flex justify-center pt-2.5">
        <span className="h-1 w-10 rounded-full" style={{ background: '#D9DDE3' }} />
      </div>
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
        <p className="text-[16px] font-bold" style={{ color: M.text }}>
          {title}
        </p>
        {badge}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="ml-auto text-[18px] leading-none"
          style={{ color: M.textMuted }}
        >
          ✕
        </button>
      </div>
      <div className="max-h-[520px] overflow-y-auto px-4 pb-2">{children}</div>
      {footer ? (
        <div className="border-t px-4 pt-3 pb-5" style={{ borderColor: M.divider }}>
          {footer}
        </div>
      ) : null}
    </div>
  )
}

/** A small state pill — "Удалено", "Изменено", "Текущая". */
export function SheetBadge({ label, tone }: { label: string; tone: MobileTone }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: TONES[tone].soft, color: TONES[tone].fg }}
    >
      {label}
    </span>
  )
}

/** The grey note box the sheets use for "only the current version counts". */
export function SheetNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px]"
      style={{ background: M.screen, color: M.textMuted }}
    >
      <span
        className="grid size-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold"
        style={{ borderColor: M.textSubtle, color: M.textSubtle }}
      >
        i
      </span>
      <span>{children}</span>
    </div>
  )
}

/** The dark primary and the outlined destructive button, side by side. */
export function SheetButtons({
  primary,
  danger,
  note,
}: {
  primary?: ReactNode
  danger?: ReactNode
  note?: string
}) {
  return (
    <>
      <div className={cn('grid gap-2', primary && danger ? 'grid-cols-2' : 'grid-cols-1')}>
        {primary ? (
          <span
            className="grid h-11 place-items-center rounded-2xl text-[13px] font-semibold"
            style={{ background: M.text, color: M.card }}
          >
            {primary}
          </span>
        ) : null}
        {danger ? (
          <span
            className="grid h-11 place-items-center rounded-2xl border text-[13px] font-semibold"
            style={{ borderColor: TONES.red.fg, color: TONES.red.fg, background: M.card }}
          >
            {danger}
          </span>
        ) : null}
      </div>
      {note ? (
        <p className="mt-2 text-center text-[10px]" style={{ color: M.textSubtle }}>
          {note}
        </p>
      ) : null}
    </>
  )
}

/** The screen's own top bar: back, title, an optional action. */
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
    <div
      className="flex h-14 shrink-0 items-center gap-2 border-b px-3"
      style={{ background: M.card, borderColor: M.border }}
    >
      <div className="flex size-9 items-center justify-center">{left}</div>
      <p className="flex-1 text-center text-[16px] font-bold" style={{ color: M.text }}>
        {title}
      </p>
      <div className="flex size-9 items-center justify-center">{right}</div>
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
      className={cn('mx-3 rounded-2xl border', padded && 'p-3.5', className)}
      style={{ background: M.card, borderColor: M.border }}
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
    <section className={cn('mt-4', className)}>
      {title ? (
        <div className="mb-2 flex items-end justify-between gap-2 px-4">
          <div>
            <h2 className="text-[15px] font-bold" style={{ color: M.text }}>
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[11px]" style={{ color: M.textSubtle }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** A tinted icon tile — round in lists, a squircle for the quick actions. */
export function IconTile({
  icon: Icon,
  tone = 'grey',
  size = 'md',
  shape = 'circle',
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  tone?: MobileTone
  size?: 'sm' | 'md'
  shape?: 'circle' | 'square'
}) {
  return (
    <span
      className={cn(
        'grid place-items-center',
        shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
        size === 'sm' ? 'size-9' : 'size-12',
      )}
      style={{ background: TONES[tone].soft }}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} style={{ color: TONES[tone].fg }} />
    </span>
  )
}
