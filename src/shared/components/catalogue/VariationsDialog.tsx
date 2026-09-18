import { useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { formatNumber } from '@/shared/lib/format'
import {
  buildProductFieldColumns,
  PRODUCT_FIELD_COLUMN_IDS,
} from '@/features/products/components/productFieldColumns'
import type { CatalogueRow, ProductGroup } from './browse'
import { t } from '@/shared/i18n'

/** What the variations table already says in its own columns. */
const SHOWN_ELSEWHERE = ['image', 'productName', 'name', 'stock']

/** One variation's choice while the dialog is open: how many, and at what price. */
export interface VariationDraft {
  quantity: number
  unitCost: number
  costCurrency: 'USD' | 'UZS'
}

export interface DialogRow<R extends CatalogueRow> {
  row: R
  draft: VariationDraft
}

export interface DraftControls<R extends CatalogueRow> {
  set: (row: R, patch: Partial<VariationDraft>) => void
}

/**
 * One product, opened from its card: every variation of it on offer, and how
 * many of each to put on the document.
 *
 * Choices are held here until the apply button, rather than written as they are
 * stepped. Closing the dialog is then a real cancel, and a card never shows a
 * number somebody was only trying out.
 */
export function VariationsDialog<R extends CatalogueRow>({
  group,
  ...props
}: {
  group: ProductGroup<R> | null
  onClose: () => void
  /** Stock boxes and figures above the table. */
  stats: (group: ProductGroup<R>) => ReactNode
  /** The document's columns for a variation, before the product-list fields. */
  columns: (controls: DraftControls<R>) => TableColumn<DialogRow<R>>[]
  initial: (row: R) => VariationDraft
  /** The most a row may take, when there is one — what a shelf can spare. */
  maxOf?: (row: R) => number
  storageKey: string
  visibleByDefault?: string[]
  canSeeCost: boolean
  /** "Add to order", or "Update the order" once some of it is on. */
  applyLabel: (alreadyOn: boolean) => string
  onApply: (changes: { row: R; draft: VariationDraft }[]) => void
}) {
  // Mounted per product, so reopening one starts from what is on the document.
  return group ? <OpenProduct key={group.productId} group={group} {...props} /> : null
}

function OpenProduct<R extends CatalogueRow>({
  group,
  onClose,
  stats,
  columns,
  initial,
  maxOf,
  storageKey,
  visibleByDefault = ['shelfAddress'],
  canSeeCost,
  applyLabel,
  onApply,
}: {
  group: ProductGroup<R>
  onClose: () => void
  stats: (group: ProductGroup<R>) => ReactNode
  columns: (controls: DraftControls<R>) => TableColumn<DialogRow<R>>[]
  initial: (row: R) => VariationDraft
  maxOf?: (row: R) => number
  storageKey: string
  visibleByDefault?: string[]
  canSeeCost: boolean
  applyLabel: (alreadyOn: boolean) => string
  onApply: (changes: { row: R; draft: VariationDraft }[]) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, VariationDraft>>(() =>
    Object.fromEntries(group.rows.map((row) => [row.key, initial(row)])),
  )

  const set = (row: R, patch: Partial<VariationDraft>) =>
    setDrafts((current) => {
      const next = { ...(current[row.key] ?? initial(row)), ...patch }
      // Never below nothing, and never more than there is to take.
      const max = maxOf?.(row) ?? Infinity
      next.quantity = Math.min(max, Math.max(0, next.quantity))
      return { ...current, [row.key]: next }
    })

  const data: DialogRow<R>[] = group.rows.map((row) => ({
    row,
    draft: drafts[row.key] ?? initial(row),
  }))

  const fields = buildProductFieldColumns<DialogRow<R>>({
    variationOf: (entry) => entry.row.variation,
    canSeeCost,
  }).filter((column) => !SHOWN_ELSEWHERE.includes(column.id ?? ''))

  const variationColumn: TableColumn<DialogRow<R>> = {
    id: 'variation',
    header: t('Variation'),
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
              {v.oem ? t(' · OEM {oem}', { oem: v.oem }) : ''}
            </p>
          </div>
        </div>
      )
    },
  }

  const units = data.reduce((sum, entry) => sum + entry.draft.quantity, 0)
  const changes = data
    .filter((entry) => JSON.stringify(entry.draft) !== JSON.stringify(initial(entry.row)))
    .map((entry) => ({ row: entry.row, draft: entry.draft }))

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
                {t('Chosen:')}{' '}
                <strong className="text-fg font-medium">{formatNumber(units)}</strong> units
              </>
            ) : (
              t('Nothing chosen')
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('Close')}
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
              {applyLabel(group.chosen > 0)}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-stretch gap-3">
          <ProductThumb src={group.rows[0]?.variation.imageUrl} size="lg" className="self-center" />
          {stats(group)}
        </div>

        <DataTable
          storageKey={storageKey}
          reorderableColumns
          initialHidden={PRODUCT_FIELD_COLUMN_IDS.filter(
            (id) => !SHOWN_ELSEWHERE.includes(id) && !visibleByDefault.includes(id),
          )}
          columns={[variationColumn, ...columns({ set }), ...fields]}
          data={data}
          total={data.length}
          getRowId={(entry) => entry.row.key}
        />
      </div>
    </Modal>
  )
}

/** A figure in the dialog's header strip. */
export function DialogStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-control bg-surface-muted min-w-32 flex-1 border px-3 py-2">
      <p className="text-fg-subtle text-2xs">{label}</p>
      <p className="text-fg text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** The compact − / number / + a variation's quantity is set with. */
export function QuantityStepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number
  max?: number
  /** What is being counted, for the buttons' names — the variation's full name. */
  label: string
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-6 [&_svg]:size-3.5"
        aria-label={t('One fewer {label}', { label: label })}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <NumberField
        className="h-6 w-14 px-1.5 text-xs"
        nullable={false}
        min={0}
        aria-label={t('Quantity of {label}', { label: label })}
        value={value}
        onChange={(next) => onChange(next ?? 0)}
      />
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-6 [&_svg]:size-3.5"
        aria-label={t('One more {label}', { label: label })}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}
