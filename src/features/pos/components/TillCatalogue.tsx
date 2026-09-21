import { useMemo } from 'react'
import { ProductCatalogue } from '@/shared/components/catalogue/ProductCatalogue'
import { StockBox, StockPill } from '@/shared/components/catalogue/StockBox'
import {
  DialogStat,
  QuantityStepper,
  VariationsDialog,
} from '@/shared/components/catalogue/VariationsDialog'
import { sumRows, type CatalogueRow, type ProductGroup } from '@/shared/components/catalogue/browse'
import type { TableColumn } from '@/shared/components/table/features'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { t } from '@/shared/i18n'

/** A variation on the till's shelf: what this shop holds of it. */
export interface TillRow extends CatalogueRow {
  here: number
}

type Group = ProductGroup<TillRow>

const here = (group: Group) => sumRows(group, (row) => row.here)
const everywhere = (group: Group) => sumRows(group, (row) => row.variation.stock)

/** One price, or the range across a product's variations. */
function price(group: Group) {
  const prices = group.rows.map((row) => row.variation.salePrice).sort((a, b) => a - b)
  const low = prices[0] ?? 0
  const high = prices.at(-1) ?? 0
  return low === high ? formatMoney(low) : `${formatMoney(low)} – ${formatMoney(high)}`
}

/**
 * The shop's shelf, browsed the way every document in the product picks
 * products — categories, make and model, cards or a list — so a cashier who
 * has built a transfer already knows the till.
 *
 * The difference is speed. A product with one variation goes straight into
 * the cart on a tap; only a product with several opens the dialog to say which.
 */
export function TillCatalogue({
  rows,
  locationName,
  onAdd,
  onSet,
}: {
  rows: TillRow[]
  locationName: string
  /** One more of a product that has a single variation. */
  onAdd: (row: TillRow) => void
  /** Quantities set in the variations dialog. */
  onSet: (changes: { row: TillRow; quantity: number }[]) => void
}) {
  const ownColumns = useMemo<TableColumn<Group>[]>(
    () => [
      {
        id: 'price',
        header: t('Price'),
        meta: { align: 'right' },
        cell: ({ row }) => <span className="font-medium tabular-nums">{price(row.original)}</span>,
      },
      {
        id: 'here',
        header: t('At {locationName}', { locationName }),
        meta: { align: 'right' },
        cell: ({ row }) => <StockPill side="mine" units={here(row.original)} />,
      },
      {
        id: 'everywhere',
        header: t('All locations'),
        meta: { align: 'right' },
        cell: ({ row }) => <StockPill side="theirs" units={everywhere(row.original)} />,
      },
    ],
    [locationName],
  )

  return (
    <ProductCatalogue
      rows={rows}
      storageKey="till"
      ownFieldsTitle={t('The till')}
      ownFields={[
        { id: 'here', label: t('At {locationName}', { locationName }) },
        { id: 'everywhere', label: t('All locations') },
      ]}
      defaultFields={['variations', 'here']}
      listFieldsShown={['sku', 'categoryPath']}
      // Selling needs the sale price, never what the part cost us.
      canSeeCost={false}
      ownColumns={ownColumns}
      showChosen={false}
      onQuickAdd={(group) => {
        if (group.rows.length !== 1) return false
        onAdd(group.rows[0]!)
        return true
      }}
      renderStats={(group, has) =>
        has('here') || has('everywhere') ? (
          <div className="grid grid-cols-2 gap-1.5">
            {has('here') ? (
              <StockBox
                side="mine"
                label={t('At {locationName}', { locationName })}
                units={here(group)}
              />
            ) : null}
            {has('everywhere') ? (
              <StockBox side="theirs" label={t('All locations')} units={everywhere(group)} />
            ) : null}
          </div>
        ) : null
      }
      // The price is what a cashier reads first, so it takes the card's corner.
      renderSales={(group) => (
        <span className="text-fg text-base font-semibold tabular-nums">{price(group)}</span>
      )}
      renderDialog={(group, close) => (
        <VariationsDialog
          group={group}
          onClose={close}
          storageKey="till-product-variations"
          canSeeCost={false}
          initial={(row) => ({
            quantity: row.quantity,
            unitCost: row.variation.costPrice,
            costCurrency: row.variation.costCurrency,
          })}
          maxOf={(row) => row.here}
          applyLabel={(alreadyOn) => (alreadyOn ? t('Update the cart') : t('Add to cart'))}
          onApply={(changes) =>
            onSet(changes.map(({ row, draft }) => ({ row, quantity: draft.quantity })))
          }
          stats={(open) => (
            <>
              <div className="min-w-32 flex-1">
                <StockBox
                  large
                  side="mine"
                  label={t('At {locationName}', { locationName })}
                  units={here(open)}
                />
              </div>
              <DialogStat label={t('Price')} value={price(open)} />
              <DialogStat label={t('Variations')} value={formatNumber(open.rows.length)} />
            </>
          )}
          columns={({ set }) => [
            {
              id: 'price',
              header: t('Price'),
              meta: { align: 'right' },
              cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                  {formatMoney(row.original.row.variation.salePrice)}
                </span>
              ),
            },
            {
              id: 'here',
              header: t('At {locationName}', { locationName }),
              meta: { align: 'right' },
              cell: ({ row }) => <StockPill side="mine" units={row.original.row.here} />,
            },
            {
              id: 'quantity',
              header: t('Qty'),
              enableHiding: false,
              meta: { align: 'right' },
              cell: ({ row }) => (
                <QuantityStepper
                  value={row.original.draft.quantity}
                  max={row.original.row.here}
                  label={row.original.row.variation.fullName}
                  onChange={(quantity) => set(row.original.row, { quantity })}
                />
              ),
            },
          ]}
        />
      )}
    />
  )
}
