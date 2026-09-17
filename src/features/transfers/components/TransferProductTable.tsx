import { useMemo, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'
import { CATALOGUE_CARD_FIELDS } from '../model/cardFields'
import type { ProductGroup } from '../model/browse'
import { StockPill } from './StockBox'

/** Visible until somebody changes it: what a card shows by default, plus where it sits. */
const FIELDS_SHOWN_BY_DEFAULT = ['categoryPath', 'vehicleMakes']

/**
 * The list view of the products step: the cards as rows.
 *
 * One row per product rather than per variation, like the cards, and the same
 * `+` opens the same dialog to choose variations and quantities in — so the two
 * views differ only in how much fits on the screen, never in how picking works.
 * Every product-list field is available from the Columns menu.
 */
export function TransferProductTable({
  groups,
  names,
  canSeeCost,
  onOpen,
  footer,
  emptyState,
  columnsMenuContainer,
}: {
  groups: ProductGroup[]
  names: { from: string; to: string; demand: string; requesting: boolean }
  canSeeCost: boolean
  onOpen: (group: ProductGroup) => void
  footer: ReactNode
  emptyState: ReactNode
  /** Where the Columns menu goes — beside the view switcher. */
  columnsMenuContainer: HTMLElement | null
}) {
  const columns = useMemo<TableColumn<ProductGroup>[]>(() => {
    const variations = (group: ProductGroup) => group.rows.map((row) => row.variation)
    const mine = names.requesting
      ? { id: 'atTo', name: names.to, units: (g: ProductGroup) => g.atDestination }
      : { id: 'atFrom', name: names.from, units: (g: ProductGroup) => g.atSource }
    const theirs = names.requesting
      ? { id: 'atFrom', name: names.from, units: (g: ProductGroup) => g.atSource }
      : { id: 'atTo', name: names.to, units: (g: ProductGroup) => g.atDestination }

    return [
      {
        id: 'image',
        header: 'Image',
        cell: ({ row }) => (
          <ProductThumb src={row.original.rows[0]?.variation.imageUrl ?? null} size="sm" />
        ),
      },
      {
        id: 'productName',
        header: 'Product name',
        enableHiding: false,
        cell: ({ row }) => <span className="font-medium">{row.original.productName}</span>,
      },
      {
        id: 'variations',
        header: 'Variations',
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(row.original.rows.length),
      },
      // Yours first, judged by level; theirs beside it, in blue — as on the cards.
      {
        id: mine.id,
        header: `At ${mine.name}`,
        meta: { align: 'right' },
        cell: ({ row }) => <StockPill side="mine" units={mine.units(row.original)} />,
      },
      {
        id: theirs.id,
        header: `At ${theirs.name}`,
        meta: { align: 'right' },
        cell: ({ row }) => <StockPill side="theirs" units={theirs.units(row.original)} />,
      },
      {
        id: 'sold',
        header: `Sold at ${names.demand}, 3 / 6 mo`,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="text-fg-muted tabular-nums">
            {formatNumber(row.original.demand[3])} /{' '}
            <strong className="text-fg font-medium">{formatNumber(row.original.demand[6])}</strong>
          </span>
        ),
      },
      ...CATALOGUE_CARD_FIELDS.filter((field) => canSeeCost || !field.costOnly).map(
        (field): TableColumn<ProductGroup> => ({
          id: field.id,
          header: field.label,
          cell: ({ row }) => {
            const value = field.value(variations(row.original))
            return (
              <span className="block max-w-56 truncate" title={value}>
                {value}
              </span>
            )
          },
        }),
      ),
      {
        id: 'choose',
        header: 'Move',
        enableHiding: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {row.original.chosen > 0 ? (
              <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
                {formatNumber(row.original.chosen)}
              </span>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="icon"
              className="size-7 [&_svg]:size-3.5"
              aria-label={`Choose variations of ${row.original.productName}`}
              onClick={(event) => {
                event.stopPropagation()
                onOpen(row.original)
              }}
            >
              <Plus />
            </Button>
          </div>
        ),
      },
    ]
  }, [names.from, names.to, names.demand, names.requesting, canSeeCost, onOpen])

  return (
    <DataTable
      storageKey="transfer-products"
      columns={columns}
      initialHidden={CATALOGUE_CARD_FIELDS.map((field) => field.id).filter(
        (id) => !FIELDS_SHOWN_BY_DEFAULT.includes(id),
      )}
      data={groups}
      total={groups.length}
      getRowId={(group) => group.productId}
      onRowClick={onOpen}
      footer={footer}
      emptyState={emptyState}
      columnsMenuContainer={columnsMenuContainer}
    />
  )
}
