import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/shared/ui/Input'

interface ListPageProps {
  /** Left of the toolbar: the search box is always first. */
  search?: { value: string; onChange: (value: string) => void; placeholder?: string }
  /** Extra filter controls, rendered after search. */
  filters?: ReactNode
  children: ReactNode
}

/**
 * The one list-page skeleton (CLAUDE.md): search/filter toolbar above a table.
 * Pair with <PageHeader> for the title + single primary action.
 * Every list screen in the app uses this — no per-page toolbars.
 */
export function ListPage({ search, filters, children }: ListPageProps) {
  return (
    <div className="space-y-3">
      {search || filters ? (
        <div className="flex flex-wrap items-center gap-2">
          {search ? (
            <div className="relative w-full max-w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <Input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder ?? 'Search…'}
                className="pl-8"
              />
            </div>
          ) : null}
          {filters}
        </div>
      ) : null}
      {children}
    </div>
  )
}
