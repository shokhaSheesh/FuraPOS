import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2, Zap } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { RowActions } from '@/shared/components/RowActions'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import type { TableColumn } from '@/shared/components/table/features'
import type { ScheduleInput } from '@/data/store'
import { useScheduleActions, useSchedules, useSchedulesSummary } from '../api/schedules'
import { ScheduleDialog } from '../components/ScheduleDialog'
import { coverageHorizon } from '../model/reorder'
import { describeDays, isDue, nextRunAt, type ReorderSchedule } from '../model/schedule'

/**
 * Reorder schedules.
 *
 * The list answers two questions and nothing else: when does this run next, and
 * what did it do last time. The second is the one OX cannot answer at all — its
 * schedule sends a notification and leaves no trace — and it is the one that
 * tells you whether the settings are any good.
 */
export default function SchedulesPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { data, isLoading } = useSchedules()
  const summary = useSchedulesSummary()
  const actions = useScheduleActions()

  const [editing, setEditing] = useState<ReorderSchedule | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<ReorderSchedule | null>(null)

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const save = (input: ScheduleInput) => {
    if (editing) {
      actions.update(editing.id, input)
      toast.success('Schedule updated')
    } else {
      const created = actions.create(input)
      toast.success(
        `${created.supplierName} will be reordered on ${describeDays(created.daysOfMonth)}`,
      )
    }
  }

  const runNow = (schedule: ReorderSchedule) => {
    const result = actions.run(schedule.id, 'manual')
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (!result.orderId) {
      // Not a failure: everything from this supplier has enough cover. Saying so
      // plainly beats an empty draft order nobody asked for.
      toast.success('Nothing needs reordering from this supplier right now')
      return
    }
    toast.success('Draft order ready to review')
    navigate(paths.procurement.orderDetail(result.orderId))
  }

  const columns = useMemo<TableColumn<ReorderSchedule>[]>(
    () => [
      {
        accessorKey: 'supplierName',
        header: 'Supplier',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg font-medium">{row.original.supplierName}</p>
            <p className="text-fg-subtle text-2xs">into {row.original.locationName}</p>
          </div>
        ),
      },
      {
        id: 'cadence',
        header: 'Runs',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg">{describeDays(row.original.daysOfMonth)} of the month</p>
            <p className="text-fg-subtle text-2xs tabular-nums">at {row.original.timeOfDay}</p>
          </div>
        ),
      },
      {
        id: 'assumptions',
        header: 'Assumes',
        cell: ({ row }) => {
          const { settings } = row.original
          return (
            <div className="min-w-0">
              <p className="text-fg tabular-nums">
                {formatNumber(coverageHorizon(settings))} days of cover
              </p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {settings.leadTimeDays}d delivery · {settings.salesWindowDays}d of sales ·{' '}
                {settings.safetyDays}d spare
              </p>
            </div>
          )
        },
      },
      {
        id: 'next',
        header: 'Next run',
        enableHiding: false,
        cell: ({ row }) => {
          const next = nextRunAt(row.original)
          if (!next) return <span className="text-fg-subtle">Paused</span>
          return (
            <div className="min-w-0">
              <p className={isDue(row.original) ? 'text-warning font-medium' : 'text-fg'}>
                {formatDateTime(next.toISOString())}
              </p>
              {isDue(row.original) ? <p className="text-warning text-2xs">due now</p> : null}
            </div>
          )
        },
      },
      {
        id: 'last',
        header: 'Last run',
        enableHiding: false,
        cell: ({ row }) => {
          const run = row.original.lastRun
          if (!run) return <span className="text-fg-subtle">Never run</span>
          return (
            <div className="min-w-0">
              <p className="text-fg-subtle text-2xs">{formatDateTime(run.at)}</p>
              {run.orderId ? (
                <Button variant="link" size="sm" className="h-auto px-0" asChild>
                  <Link
                    to={paths.procurement.orderDetail(run.orderId)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {run.orderNumber} · {formatNumber(run.products)} products
                  </Link>
                </Button>
              ) : (
                <p className="text-fg-muted">Nothing needed ordering</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'lastValue',
        header: 'Last drafted',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const run = row.original.lastRun
          if (!run || !run.orderId) return <span className="text-fg-subtle">—</span>
          return (
            <div>
              <p className="text-fg tabular-nums">{formatNumber(run.units)} units</p>
              <p className="text-fg-subtle text-2xs tabular-nums">
                {formatMoney(Math.round(run.value))}
              </p>
            </div>
          )
        },
      },
      {
        accessorKey: 'active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge tone={row.original.active ? 'success' : 'neutral'}>
            {row.original.active ? 'Active' : 'Paused'}
          </Badge>
        ),
      },
      { accessorKey: 'createdBy', header: 'Created by' },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: 'Run now',
                icon: Zap,
                onSelect: () => runNow(row.original),
                hidden: !can('procurement.schedules.edit'),
              },
              {
                label: row.original.active ? 'Pause' : 'Resume',
                icon: row.original.active ? Pause : Play,
                onSelect: () => {
                  actions.pause(row.original)
                  toast.success(row.original.active ? 'Schedule paused' : 'Schedule resumed')
                },
                hidden: !can('procurement.schedules.edit'),
              },
              {
                label: 'Edit',
                icon: Pencil,
                onSelect: () => {
                  setEditing(row.original)
                  setDialogOpen(true)
                },
                hidden: !can('procurement.schedules.edit'),
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleting(row.original),
                hidden: !can('procurement.schedules.delete'),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  )

  const tiles = [
    {
      label: 'Active schedules',
      value: formatNumber(summary.active),
      meta: 'running on their own',
    },
    {
      label: 'Due now',
      value: formatNumber(summary.due),
      meta: 'past their run time',
      tone: summary.due > 0 ? ('warning' as const) : undefined,
    },
    {
      label: 'Drafts waiting',
      value: formatNumber(summary.drafted),
      meta: 'orders left for someone to check',
    },
  ]

  return (
    <>
      <PageHeader
        title="Reorder schedules"
        description="On the days you choose, the system works out what to reorder from a supplier — from stock, sales rate, delivery time and MOQ — and leaves a draft order waiting in Orders. Nothing is ever sent to a supplier without a person approving it."
        action={
          can('procurement.schedules.create') ? (
            <Button variant="primary" onClick={openNew}>
              <Plus />
              Add schedule
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className="flex items-start gap-3 p-4">
            <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <CalendarClock className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg-muted text-sm">{tile.label}</p>
              <p
                className={`mt-0.5 text-lg font-semibold ${
                  tile.tone === 'warning' ? 'text-warning' : 'text-fg'
                }`}
              >
                {tile.value}
              </p>
              <p className="text-fg-subtle text-2xs">{tile.meta}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        storageKey="schedules"
        columns={columns}
        initialHidden={['createdBy']}
        data={data.items}
        total={data.total}
        isLoading={isLoading}
        pagination={{ page: 1, pageSize: 25 }}
        onPaginationChange={() => {}}
        emptyState={
          <EmptyState
            title="No schedules yet"
            description="A schedule saves someone working out what to reorder by hand every fortnight. It counts stock, reads how fast each part sells, allows for the delivery time, and leaves a draft order for you to check."
            action={
              can('procurement.schedules.create') ? (
                <Button variant="primary" onClick={openNew}>
                  <Plus />
                  Add schedule
                </Button>
              ) : null
            }
          />
        }
      />

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={editing}
        onSave={save}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete the ${deleting?.supplierName} schedule?`}
        body="Draft orders it has already produced are not affected — they stay in Orders."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) actions.remove(deleting.id)
          setDeleting(null)
          toast.success('Schedule deleted')
        }}
      />
    </>
  )
}
