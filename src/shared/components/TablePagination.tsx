import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'
import { PAGE_SIZE_OPTIONS } from '@/shared/types'

export interface PaginationState {
  page: number
  pageSize: number
}

interface TablePaginationProps {
  total: number
  pagination: PaginationState
  onChange: (next: PaginationState) => void
}

/** The standard footer under every list table. */
export function TablePagination({ total, pagination, onChange }: TablePaginationProps) {
  const { page, pageSize } = pagination
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2">
      <p className="text-fg-muted text-sm">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>

      <div className="flex items-center gap-3">
        <label className="text-fg-muted flex items-center gap-2 text-sm">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onChange({ page: 1, pageSize: Number(event.target.value) })}
            className="rounded-control border-border bg-surface text-fg h-8 border px-2 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onChange({ ...pagination, page: page - 1 })}
          >
            <ChevronLeft />
          </Button>
          <span className="text-fg-muted min-w-16 text-center text-sm">
            {page} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onChange({ ...pagination, page: page + 1 })}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
