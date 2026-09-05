import { cn } from '@/shared/lib/cn'

/**
 * The brand lockup for the sidebar. The mark's black outlines disappear on
 * the black chrome, so it sits on a white backing tile — the treatment the
 * brand guidelines prescribe for dark and busy backgrounds (p.9). The mark
 * itself is never recolored, rotated, stretched or given effects (p.7).
 */
export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="rounded-control flex size-8 shrink-0 items-center justify-center bg-white">
        <img src="/brand/logo-256.png" alt="" width={28} height={28} className="size-7" />
      </span>
      {!collapsed ? (
        <span className="text-chrome-fg text-sm leading-none font-semibold tracking-tight">
          FURA SENTR
        </span>
      ) : null}
    </span>
  )
}
