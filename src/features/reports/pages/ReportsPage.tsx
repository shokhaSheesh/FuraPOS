import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Pin, PinOff, Play, Plus, Pencil, Table2, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { RowActions } from '@/shared/components/RowActions'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import { useReportActions, useReports } from '../api/reports'
import { REPORT_SOURCES, describeReport, sourceLabel, type ReportDefinition } from '../model/report'

/**
 * Saved reports.
 *
 * A report is a question somebody described once and re-runs — so the list is
 * of *definitions*, not results. Pinned first, because those are the ones
 * somebody opens every Monday.
 */
export default function ReportsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data, isLoading } = useReports({ search: query.search, source: query.source })
  const actions = useReportActions()
  const [deleting, setDeleting] = useState<ReportDefinition | null>(null)

  const columns = useMemo<TableColumn<ReportDefinition>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Report',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg flex items-center gap-1.5 truncate font-medium">
              {row.original.name}
              {row.original.pinned ? (
                <Pin className="text-fg-subtle size-3" aria-label="Pinned to the sidebar" />
              ) : null}
            </p>
            <p className="text-fg-subtle text-2xs truncate">{describeReport(row.original)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'source',
        header: 'Data',
        enableHiding: false,
        cell: ({ row }) => <Badge tone="info">{sourceLabel(row.original.source)}</Badge>,
      },
      { accessorKey: 'createdBy', header: 'Made by' },
      {
        accessorKey: 'updatedAt',
        header: 'Last changed',
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: 'Run',
                icon: Play,
                onSelect: () => navigate(paths.analytics.reportView(row.original.id)),
              },
              {
                label: row.original.pinned ? 'Unpin from sidebar' : 'Pin to sidebar',
                icon: row.original.pinned ? PinOff : Pin,
                hidden: !can('analytics.reportBuilder.edit'),
                onSelect: () => {
                  actions.setPinned(row.original.id, !row.original.pinned)
                  toast.success(row.original.pinned ? 'Unpinned' : 'Pinned to the sidebar')
                },
              },
              {
                label: 'Edit',
                icon: Pencil,
                hidden: !can('analytics.reportBuilder.edit'),
                onSelect: () => navigate(paths.analytics.editReport(row.original.id)),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                hidden: !can('analytics.reportBuilder.delete'),
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [can, navigate, actions],
  )

  return (
    <>
      <PageHeader
        title="Report generator"
        description="Build a table once — what to measure, what to split it by — then save it and re-run it whenever you like. Reports read the data as it stands, so they are always current."
        action={
          can('analytics.reportBuilder.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.analytics.newReport}>
                <Plus />
                New report
              </Link>
            </Button>
          ) : null
        }
        below={
          <StatusChips
            ariaLabel="Filter by data source"
            options={[
              { value: null, label: 'All' },
              ...REPORT_SOURCES.map((entry) => ({ value: entry.value, label: entry.label })),
            ]}
            value={(query.source as string | null) ?? null}
            onChange={(source) => setQuery({ source, page: null })}
          />
        }
      />

      <DataTable
        storageKey="reports"
        columns={columns}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search reports…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(report) => navigate(paths.analytics.reportView(report.id))}
        emptyState={
          query.search || query.source ? (
            <EmptyState title="No reports match these filters" />
          ) : (
            <EmptyState
              icon={Table2}
              title="No reports yet"
              description="A report saves you rebuilding the same table every month. Pick what to measure and what to break it down by, and it is there next time."
              action={
                can('analytics.reportBuilder.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.analytics.newReport}>
                      <Plus />
                      New report
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete "${deleting?.name}"?`}
        body="Only the saved question goes. No data is touched — you can always build it again."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) actions.remove(deleting.id)
          setDeleting(null)
          toast.success('Report deleted')
        }}
      />
    </>
  )
}
