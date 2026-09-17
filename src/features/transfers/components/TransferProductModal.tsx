import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { formatNumber } from '@/shared/lib/format'
import { unitsSoldAt } from '@/shared/lib/demand'
import { useDataStore } from '@/data/store'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import type { ProductGroup } from '../model/browse'
import type { TransferRow } from './transferLineColumns'

/** What the variations table already says in its own columns. */
const SHOWN_ELSEWHERE = ['image', 'productName', 'name', 'stock']
/** Visible until somebody changes it: the mockup's table, plus where it sits. */
const VISIBLE_BY_DEFAULT = ['shelfAddress']

interface VariantRow {
  row: TransferRow
  sold12: number
  draft: number
}

/**
 * One product, opened from its card: every variation of it the source can
 * spare, and how many of each to move.
 *
 * Quantities are held here until "Add to transfer", rather than written as
 * they are stepped. Closing the dialog is then a real cancel, and a card never
 * shows a number somebody was only trying out.
 */
export function TransferProductModal({
  group,
  onOpenChange,
  fromName,
  toName,
  demandName,
  demandLocationId,
  canSeeCost,
  onApply,
}: {
  group: ProductGroup | null
  onOpenChange: (open: boolean) => void
  fromName: string
  toName: string
  demandName: string
  demandLocationId: string | null
  canSeeCost: boolean
  onApply: (changes: { row: TransferRow; quantity: number }[]) => void
}) {
  // Mounted per product, so reopening one starts from what is on the transfer.
  return group ? (
    <OpenProduct
      key={group.productId}
      group={group}
      fromName={fromName}
      toName={toName}
      demandName={demandName}
      demandLocationId={demandLocationId}
      canSeeCost={canSeeCost}
      onClose={() => onOpenChange(false)}
      onApply={onApply}
    />
  ) : null
}

function OpenProduct({
  group,
  fromName,
  toName,
  demandName,
  demandLocationId,
  canSeeCost,
  onClose,
  onApply,
}: {
  group: ProductGroup
  fromName: string
  toName: string
  demandName: string
  demandLocationId: string | null
  canSeeCost: boolean
  onClose: () => void
  onApply: (changes: { row: TransferRow; quantity: number }[]) => void
}) {
  const sales = useDataStore((s) => s.sales)
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(group.rows.map((row) => [row.key, row.quantity])),
  )

  const sold12 = useMemo(
    () =>
      Object.fromEntries(
        group.rows.map((row) => [
          row.key,
          demandLocationId ? unitsSoldAt(sales, row.variation.id, demandLocationId, 12) : 0,
        ]),
      ),
    [group.rows, sales, demandLocationId],
  )

  const set = (row: TransferRow, quantity: number) =>
    setDraft((current) => ({
      ...current,
      // Never more than the shelf holds, never below nothing.
      [row.key]: Math.min(row.atSource, Math.max(0, quantity)),
    }))

  const data: VariantRow[] = group.rows.map((row) => ({
    row,
    sold12: sold12[row.key] ?? 0,
    draft: draft[row.key] ?? 0,
  }))

  const columns = buildVariantColumns({ fromName, toName, demandName, canSeeCost, set })

  const units = data.reduce((sum, entry) => sum + entry.draft, 0)
  const changes = data
    .filter((entry) => entry.draft !== entry.row.quantity)
    .map((entry) => ({ row: entry.row, quantity: entry.draft }))
  const alreadyOn = group.chosen > 0

  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={group.productName}
      description={`${group.categoryPath} · ${group.rows.length} ${group.rows.length === 1 ? 'variation' : 'variations'}`}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-fg-muted text-sm">
            {units > 0 ? (
              <>
                Chosen: <strong className="text-fg font-medium">{formatNumber(units)}</strong> units
              </>
            ) : (
              'Nothing chosen'
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={changes.length === 0}
              onClick={() => {
                onApply(changes)
                onClose()
              }}
            >
              {alreadyOn ? 'Update the transfer' : 'Add to transfer'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-stretch gap-3">
          <ProductThumb src={group.rows[0]?.variation.imageUrl} size="lg" />
          <Stat label={`At ${toName}`} value={`${formatNumber(group.atDestination)}`} />
          <Stat label={`At ${fromName}`} value={`${formatNumber(group.atSource)}`} />
          <Stat
            label={`Sold at ${demandName}, 3 / 6 months`}
            value={`${formatNumber(group.demand[3])} / ${formatNumber(group.demand[6])}`}
          />
          <Stat label="Variations" value={formatNumber(group.rows.length)} />
        </div>

        <DataTable
          storageKey="transfer-product-variations"
          initialHidden={PRODUCT_FIELD_COLUMN_IDS.filter(
            (id) => !SHOWN_ELSEWHERE.includes(id) && !VISIBLE_BY_DEFAULT.includes(id),
          )}
          columns={columns}
          data={data}
          total={data.length}
          getRowId={(entry) => entry.row.key}
        />
      </div>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-control bg-surface-muted min-w-32 flex-1 border px-3 py-2">
      <p className="text-fg-subtle text-2xs">{label}</p>
      <p className="text-fg text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function buildVariantColumns({
  fromName,
  toName,
  demandName,
  canSeeCost,
  set,
}: {
  fromName: string
  toName: string
  demandName: string
  canSeeCost: boolean
  set: (row: TransferRow, quantity: number) => void
}): TableColumn<VariantRow>[] {
  const fields = buildProductFieldColumns<VariantRow>({
    variationOf: (entry) => entry.row.variation,
    canSeeCost,
  }).filter((column) => !SHOWN_ELSEWHERE.includes(column.id ?? ''))

  const own: TableColumn<VariantRow>[] = [
    {
      id: 'variation',
      header: 'Variation',
      enableHiding: false,
      cell: ({ row }) => {
        const v = row.original.row.variation
        return (
          <div className="flex items-center gap-2">
            <ProductThumb src={v.imageUrl} size="sm" />
            <div className="min-w-0">
              <p className="text-fg text-sm font-medium">{v.name || v.productName}</p>
              <p className="text-fg-subtle text-2xs font-mono">
                {v.sku}
                {v.oem ? ` · OEM ${v.oem}` : ''}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      id: 'atFrom',
      header: `At ${fromName}`,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-fg font-medium tabular-nums">
          {formatNumber(row.original.row.atSource)}
        </span>
      ),
    },
    {
      id: 'atTo',
      header: `At ${toName}`,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-fg-muted tabular-nums">
          {formatNumber(row.original.row.atDestination)}
        </span>
      ),
    },
    {
      id: 'sold',
      header: `Sold at ${demandName}, 3 / 6 / 12 mo`,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-fg-muted tabular-nums">
          {formatNumber(row.original.row.demand[3])} /{' '}
          <strong className="text-fg font-medium">
            {formatNumber(row.original.row.demand[6])}
          </strong>{' '}
          / {formatNumber(row.original.sold12)}
        </span>
      ),
    },
    {
      id: 'move',
      header: 'Move',
      enableHiding: false,
      meta: { align: 'right' },
      cell: ({ row }) => {
        const { row: line, draft } = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`One fewer ${line.variation.fullName}`}
              disabled={draft <= 0}
              onClick={() => set(line, draft - 1)}
            >
              <Minus />
            </Button>
            <NumberField
              className="w-20"
              nullable={false}
              min={0}
              aria-label={`Move ${line.variation.fullName}`}
              value={draft}
              onChange={(next) => set(line, next ?? 0)}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`One more ${line.variation.fullName}`}
              disabled={draft >= line.atSource}
              onClick={() => set(line, draft + 1)}
            >
              <Plus />
            </Button>
          </div>
        )
      },
    },
  ]

  return [...own, ...fields]
}
