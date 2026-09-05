import { cn } from '@/shared/lib/cn'

/**
 * The brand lockup. The mark is never recolored, rotated, stretched or given
 * effects (brand guidelines p.7) — so this component takes a size and nothing
 * else. The wordmark next to it is set in the display face.
 */
export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <img
        src="/brand/logo-512.png"
        alt="Fura Sentr"
        width={28}
        height={28}
        className="size-7 shrink-0"
      />
      {!collapsed ? (
        <span className="text-sm font-semibold leading-none tracking-tight text-chrome-fg">
          FURA SENTR
        </span>
      ) : null}
    </span>
  )
}
