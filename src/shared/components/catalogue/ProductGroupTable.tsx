import { useMemo, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { DataTable } from '@/shared/components/DataTable'
import { ProductThumb } from '@/shared/components/ProductThumb'
import type { TableColumn } from '@/shared/components/table/features'
import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'
import { CATALOGUE_CARD_FIELDS } from './cardFields'
import type { CatalogueRow, ProductGroup } from './browse'
import { t } from '@/shared/i18n'

/**
 * The list view of a product step: the cards as rows.
 *
 * One row per product rather than per variation, like the cards, and the same
 * `+` opens the same dialog to choose variations and quantities in — so the two
 * views differ only in how much fits on the screen, never in how picking works.
 * Every product-list field is available from the Columns menu.
 */
export function ProductGroupTable<R extends CatalogueRow>({
  storageKey,
  groups,
  ownColumns,
  listFieldsShown,
  canSeeCost,
  onOpen,
  footer,
  emptyState,
  columnsMenuContainer,
}: {
  storageKey: string
  groups: ProductGroup<R>[]
  /** The document's own columns, straight after the product name. */
  ownColumns: TableColumn<ProductGroup<R>>[]
  /** Product-list fields visible until somebody changes it. */
  listFieldsShown: string[]
  canSeeCost: boolean
  onOpen: (group: ProductGroup<R>) => void
  footer: ReactNode
  emptyState: ReactNode
  /** Where the Columns menu goes — beside the view switcher. */
  columnsMenuContainer: HTMLElement | null
}) {
  const columns = useMemo<TableColumn<ProductGroup<R>>[]>(
    () => [
      {
        id: 'image',
        header: t('Image'),
        cell: ({ row }) => (
          <ProductThumb src={row.original.rows[0]?.variation.imageUrl ?? null} size="sm" />
        ),
      },
      {
        id: 'productName',
        header: t('Product name'),
        enableHiding: false,
        cell: ({ row }) => <span className="font-medium">{row.original.productName}</span>,
      },
      {
        id: 'variations',
        header: t('Variations'),
        meta: { align: 'right' },
        cell: ({ row }) => formatNumber(row.original.rows.length),
      },
      ...ownColumns,
      ...CATALOGUE_CARD_FIELDS.filter((field) => canSeeCost || !field.costOnly).map(
        (field): TableColumn<ProductGroup<R>> => ({
          id: field.id,
          header: field.label,
          cell: ({ row }) => {
            const value = field.value(row.original.rows.map((r) => r.variation))
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
        header: t('Choose'),
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
              aria-label={t('Choose variations of {productName}', {
                productName: row.original.productName,
              })}
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
    ],
    [ownColumns, canSeeCost, onOpen],
  )

  return (
    <DataTable
      reorderableColumns
      storageKey={storageKey}
      columns={columns}
      initialHidden={CATALOGUE_CARD_FIELDS.map((field) => field.id).filter(
        (id) => !listFieldsShown.includes(id),
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
