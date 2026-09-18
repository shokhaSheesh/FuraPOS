import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Pin, PinOff, Play, Plus, Pencil, Table2, Trash2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { REPORT_FILTER_OVERRIDES } from '../model/reportFilterFields'
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
import { t } from '@/shared/i18n'

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
  const { data: everyReport } = useReports()
  const { data, isLoading } = useReports({ search: query.search, source: query.source, f: query.f })
  const actions = useReportActions()
  const [deleting, setDeleting] = useState<ReportDefinition | null>(null)

  const columns = useMemo<TableColumn<ReportDefinition>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('Report'),
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg flex items-center gap-1.5 truncate font-medium">
              {row.original.name}
              {row.original.pinned ? (
                <Pin className="text-fg-subtle size-3" aria-label={t('Pinned to the sidebar')} />
              ) : null}
            </p>
            <p className="text-fg-subtle text-2xs truncate">{describeReport(row.original)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'source',
        header: t('Data'),
        enableHiding: false,
        cell: ({ row }) => <Badge tone="info">{sourceLabel(row.original.source)}</Badge>,
      },
      { accessorKey: 'createdBy', header: t('Made by') },
      {
        accessorKey: 'updatedAt',
        header: t('Last changed'),
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
                label: t('Run'),
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
                label: t('Edit'),
                icon: Pencil,
                hidden: !can('analytics.reportBuilder.edit'),
                onSelect: () => navigate(paths.analytics.editReport(row.original.id)),
              },
              {
                label: t('Delete'),
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
        title={t('Report generator')}
        description={t(
          'Build a table once — what to measure, what to split it by — then save it and re-run it whenever you like. Reports read the data as it stands, so they are always current.',
        )}
        action={
          can('analytics.reportBuilder.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.analytics.newReport}>
                <Plus />
                {t('New report')}
              </Link>
            </Button>
          ) : null
        }
        below={
          <StatusChips
            ariaLabel={t('Filter by data source')}
            options={[
              { value: null, label: t('All') },
              ...REPORT_SOURCES.map((entry) => ({ value: entry.value, label: t(entry.label) })),
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
          <ColumnFilterSearch
            columns={columns}
            rows={everyReport.items}
            overrides={REPORT_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(report) => navigate(paths.analytics.reportView(report.id))}
        emptyState={
          query.search || query.f || query.source ? (
            <EmptyState title={t('No reports match these filters')} />
          ) : (
            <EmptyState
              icon={Table2}
              title={t('No reports yet')}
              description={t(
                'A report saves you rebuilding the same table every month. Pick what to measure and what to break it down by, and it is there next time.',
              )}
              action={
                can('analytics.reportBuilder.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.analytics.newReport}>
                      <Plus />
                      {t('New report')}
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
        title={t('Delete "{name}"?', { name: deleting?.name })}
        body="Only the saved question goes. No data is touched — you can always build it again."
        confirmLabel={t('Delete')}
        destructive
        onConfirm={() => {
          if (deleting) actions.remove(deleting.id)
          setDeleting(null)
          toast.success(t('Report deleted'))
        }}
      />
    </>
  )
}
