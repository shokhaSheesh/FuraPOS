import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { RowActions } from '@/shared/components/RowActions'
import { Field } from '@/shared/components/Field'
import { NumberField } from '@/shared/components/NumberField'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import type { TableColumn } from '@/shared/components/table/features'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { DEFAULT_SETTINGS, coverageHorizon } from '../model/reorder'
import {
  recommendations,
  selectionCost,
  selectionDraftSchema,
  selectionSourceLabel,
  selectionStatusLabel,
  selectionStatusTone,
  selectionUnits,
  SELECTION_SOURCES,
  type ProductSelection,
  type SelectionDraft,
} from '../model/selection'

/**
 * Selection runs, as OX keeps them: a log of times someone asked "what should
 * we order", each with the answer it produced.
 *
 * The obvious build is a live screen that recalculates on every visit. It is
 * wrong because the schedule page would then have nothing to schedule, and
 * because "what did last month's run say" becomes unanswerable the moment the
 * answer is regenerated.
 */
export default function SelectionsListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const selections = useDataStore((s) => s.selections)
  const suppliers = useDataStore((s) => s.suppliers)
  const locations = useDataStore((s) => s.locations)
  const run = useDataStore((s) => s.runSelection)
  const remove = useDataStore((s) => s.deleteSelection)

  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProductSelection | null>(null)

  const form = useForm<SelectionDraft>({
    resolver: zodResolver(selectionDraftSchema),
    defaultValues: {
      source: 'suppliers',
      supplierId: '',
      salesWindowDays: DEFAULT_SETTINGS.salesWindowDays,
      leadTimeDays: DEFAULT_SETTINGS.leadTimeDays,
      orderIntervalDays: DEFAULT_SETTINGS.orderIntervalDays,
      safetyDays: DEFAULT_SETTINGS.safetyDays,
      locationIds: [],
      comment: '',
    },
  })

  const source = form.watch('source')
  const settings = {
    salesWindowDays: form.watch('salesWindowDays'),
    leadTimeDays: form.watch('leadTimeDays'),
    orderIntervalDays: form.watch('orderIntervalDays'),
    safetyDays: form.watch('safetyDays'),
  }
  const locationIds = form.watch('locationIds')

  const rows = useMemo(() => {
    const filtered = selections.filter((selection) => {
      if (query.source && selection.source !== query.source) return false
      return true
    })
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [selections, query.source])

  const counts = useMemo(
    () => ({
      all: selections.length,
      suppliers: selections.filter((s) => s.source === 'suppliers').length,
      marketplace: selections.filter((s) => s.source === 'marketplace').length,
    }),
    [selections],
  )

  const submit = form.handleSubmit(
    (values) => {
      const selection = run({
        source: values.source,
        supplierId: values.supplierId,
        settings: {
          salesWindowDays: values.salesWindowDays,
          leadTimeDays: values.leadTimeDays,
          orderIntervalDays: values.orderIntervalDays,
          safetyDays: values.safetyDays,
        },
        locationIds: values.locationIds,
        comment: values.comment,
      })
      setOpen(false)
      if (selection.status === 'failed') {
        toast.error(selection.failureReason ?? 'That run produced nothing')
      } else {
        toast.success(
          `${selection.number} — ${formatNumber(recommendations(selection).length)} recommendations`,
        )
      }
      navigate(paths.procurement.selectionDetail(selection.id))
    },
    () => toast.error('Check the highlighted fields'),
  )

  const columns = useMemo<TableColumn<ProductSelection>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Created',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg">{formatDateTime(row.original.createdAt)}</p>
            <p className="text-fg-subtle text-2xs font-mono">{row.original.number}</p>
          </div>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-fg">{selectionSourceLabel(row.original.source)}</p>
            {row.original.supplierName ? (
              <p className="text-fg-subtle text-2xs">{row.original.supplierName}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Badge tone={selectionStatusTone(row.original.status)}>
              {selectionStatusLabel(row.original.status)}
            </Badge>
            {row.original.failureReason ? (
              <p className="text-fg-subtle text-2xs mt-1">{row.original.failureReason}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'recommendations',
        header: 'Recommendations',
        meta: { align: 'right' },
        enableHiding: false,
        cell: ({ row }) => {
          const count = recommendations(row.original).length
          if (row.original.status === 'failed') return <span className="text-fg-subtle">—</span>
          return (
            <div>
              <p className={count > 0 ? 'text-fg font-semibold' : 'text-fg-subtle'}>
                {formatNumber(count)}
              </p>
              {count > 0 ? (
                <p className="text-fg-subtle text-2xs">
                  {formatNumber(selectionUnits(row.original))} units ·{' '}
                  {formatMoney(Math.round(selectionCost(row.original, USD_RATE)))}
                </p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'horizon',
        header: 'Covering',
        meta: { align: 'right' },
        cell: ({ row }) => `${formatNumber(coverageHorizon(row.original.settings))} days`,
      },
      { accessorKey: 'createdBy', header: 'Run by' },
      {
        accessorKey: 'comment',
        header: 'Note',
        cell: ({ row }) => row.original.comment ?? <span className="text-fg-subtle">—</span>,
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: 'Delete run',
                icon: Trash2,
                destructive: true,
                hidden: !can('procurement.selection.view'),
                onSelect: () => setPendingDelete(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [can],
  )

  return (
    <>
      <PageHeader
        title="Product selection"
        description="Working out what to order: from your own suppliers, using stock, sales and their minimum order. Each run is kept with its answer."
        action={
          can('procurement.selection.view') ? (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus />
              Work out what to order
            </Button>
          ) : null
        }
        below={
          <StatusChips
            ariaLabel="Filter by source"
            options={[
              { value: null, label: 'All' },
              { value: 'suppliers', label: 'From suppliers' },
              { value: 'marketplace', label: 'From marketplaces' },
            ]}
            value={(query.source as string | null) ?? null}
            onChange={(next) => setQuery({ source: next })}
            counts={counts}
          />
        }
      />

      <DataTable
        storageKey="selections"
        columns={columns}
        initialHidden={['createdBy', 'comment']}
        data={rows}
        total={rows.length}
        isLoading={false}
        pagination={{ page: 1, pageSize: rows.length || 1 }}
        onPaginationChange={() => {}}
        onRowClick={(selection) => navigate(paths.procurement.selectionDetail(selection.id))}
        emptyState={
          <EmptyState
            title="No selections yet — start the first"
            description="A run reads your stock, your sales and each supplier's minimum order, and tells you what to buy."
            action={
              can('procurement.selection.view') ? (
                <Button variant="primary" onClick={() => setOpen(true)}>
                  <Plus />
                  Work out what to order
                </Button>
              ) : null
            }
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Work out what to order"
        description="Reads stock, sales and minimum order quantities as they are right now, and keeps the answer."
        primary={{ label: 'Calculate', onClick: submit }}
      >
        <div className="space-y-3">
          <Field
            label="Where from"
            required
            hint={SELECTION_SOURCES.find((s) => s.value === source)?.hint}
          >
            {(p) => (
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select
                    {...p}
                    className="w-full"
                    value={field.value}
                    onChange={field.onChange}
                    options={SELECTION_SOURCES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                )}
              />
            )}
          </Field>

          {source === 'suppliers' ? (
            <Field
              label="Supplier"
              required
              hint="One order goes to one company, so a run is scoped to one"
              error={form.formState.errors.supplierId?.message}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <Select
                      {...p}
                      className="w-full"
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder="Pick a supplier"
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  )}
                />
              )}
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sales period" hint="Days of history to judge demand on">
              {(p) => (
                <Controller
                  control={form.control}
                  name="salesWindowDays"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      nullable={false}
                      min={7}
                      value={field.value}
                      onChange={(next) => field.onChange(Math.max(7, next ?? 7))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="A delivery takes" hint="Days from ordering to it being on the shelf">
              {(p) => (
                <Controller
                  control={form.control}
                  name="leadTimeDays"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      nullable={false}
                      min={1}
                      value={field.value}
                      onChange={(next) => field.onChange(Math.max(1, next ?? 1))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Until the next order" hint="Days between one order and the next">
              {(p) => (
                <Controller
                  control={form.control}
                  name="orderIntervalDays"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      nullable={false}
                      min={1}
                      value={field.value}
                      onChange={(next) => field.onChange(Math.max(1, next ?? 1))}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Safety stock" hint="Extra days of cover on top">
              {(p) => (
                <Controller
                  control={form.control}
                  name="safetyDays"
                  render={({ field }) => (
                    <NumberField
                      {...p}
                      className="w-full"
                      nullable={false}
                      min={0}
                      value={field.value}
                      onChange={(next) => field.onChange(Math.max(0, next ?? 0))}
                    />
                  )}
                />
              )}
            </Field>
          </div>

          {/* The three numbers add up to one, and that one is what an order has
              to last. Showing it stops the fields reading as unrelated knobs. */}
          <p className="text-fg-muted text-sm">
            Each order will cover{' '}
            <span className="text-fg font-semibold">{coverageHorizon(settings)} days</span> of
            demand — {settings.leadTimeDays} to arrive, {settings.orderIntervalDays} until the next
            one, {settings.safetyDays} spare.
          </p>

          <Field label="Locations" hint="Stock and sales counted at these only. None means all.">
            {() => (
              <div className="flex flex-wrap gap-1.5">
                {locations.map((location) => {
                  const on = locationIds.includes(location.id)
                  return (
                    <button
                      key={location.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        form.setValue(
                          'locationIds',
                          on
                            ? locationIds.filter((id) => id !== location.id)
                            : [...locationIds, location.id],
                        )
                      }
                      className={cn(
                        'rounded-control border px-2.5 py-1 text-sm transition-colors',
                        on
                          ? 'border-fg bg-fg text-fg-inverted'
                          : 'border-border text-fg-muted hover:border-border-strong hover:text-fg',
                      )}
                    >
                      {location.name}
                    </button>
                  )
                })}
              </div>
            )}
          </Field>

          <Field label="Note" hint="Why this run is happening">
            {(p) => <Input {...p} placeholder="Monthly container" {...form.register('comment')} />}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete this run?"
        confirmLabel="Delete"
        body={
          pendingDelete
            ? `${pendingDelete.number} and the answer it produced are removed. Nothing else changes.`
            : null
        }
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete.id)
          toast.success(`${pendingDelete?.number} deleted`)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
