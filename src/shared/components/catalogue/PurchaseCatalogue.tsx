import { useMemo, type ReactNode } from 'react'
import { NumberField } from '@/shared/components/NumberField'
import type { TableColumn } from '@/shared/components/table/features'
import { Select } from '@/shared/ui/Select'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { ProductCatalogue, SalesFigures } from './ProductCatalogue'
import { StockBox, StockPill } from './StockBox'
import {
  DialogStat,
  QuantityStepper,
  VariationsDialog,
  type VariationDraft,
} from './VariationsDialog'
import { sumRows, type ProductGroup } from './browse'
import type { PurchaseRow } from './purchaseRows'
import { t } from '@/shared/i18n'

type Group = ProductGroup<PurchaseRow>

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'UZS', label: 'UZS' },
]

const atLocation = (group: Group) => sumRows(group, (row) => row.atLocation)
const everywhere = (group: Group) => sumRows(group, (row) => row.variation.stock)
const expected = (group: Group) => sumRows(group, (row) => row.expected ?? 0)

const money = (amount: number, currency: 'USD' | 'UZS') =>
  currency === 'USD' ? `${formatNumber(amount)} USD` : formatMoney(amount)

/** One price, or the range across a product's variations. */
function priceRange(group: Group) {
  const prices = group.rows.map((row) => money(row.unitCost, row.costCurrency))
  const sorted = [...group.rows].sort((a, b) => a.unitCost - b.unitCost)
  const low = money(sorted[0]!.unitCost, sorted[0]!.costCurrency)
  const high = money(sorted.at(-1)!.unitCost, sorted.at(-1)!.costCurrency)
  return prices.length && low !== high ? `${low} – ${high}` : low
}

/**
 * The product step of a purchase order or a goods receipt: the shared
 * catalogue, with what buying in needs on it — stock where the goods will land
 * (judged by level, the red-amber-green of a transfer) beside stock across the
 * business (in blue), what sold, and the price, which is set per variation in
 * the dialog along with the quantity.
 */
export function PurchaseCatalogue({
  rows,
  storageKey,
  noun,
  locationName,
  canSeeCost,
  showExpected = false,
  actions,
  summary,
  onApply,
}: {
  rows: PurchaseRow[]
  /** "order" or "receipt" — what this browser remembers its view and fields under. */
  storageKey: string
  /** How the document is named on its buttons: "order", "receipt". */
  noun: string
  /** Where the goods will land. */
  locationName: string
  canSeeCost: boolean
  /** A delivery against an order has an expected quantity per line; an order does not. */
  showExpected?: boolean
  actions?: ReactNode
  summary?: ReactNode
  onApply: (changes: { row: PurchaseRow; draft: VariationDraft }[]) => void
}) {
  const ownColumns = useMemo<TableColumn<Group>[]>(
    () => [
      {
        id: 'atLocation',
        header: `At ${locationName}`,
        meta: { align: 'right' },
        cell: ({ row }) => <StockPill side="mine" units={atLocation(row.original)} />,
      },
      {
        id: 'everywhere',
        header: t('All locations'),
        meta: { align: 'right' },
        cell: ({ row }) => <StockPill side="theirs" units={everywhere(row.original)} />,
      },
      ...(showExpected
        ? [
            {
              id: 'expected',
              header: t('Expected'),
              meta: { align: 'right' },
              cell: ({ row }) => formatNumber(expected(row.original)),
            } satisfies TableColumn<Group>,
          ]
        : []),
      {
        id: 'sold',
        header: t('Sold, 3 / 6 mo'),
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="text-fg-muted tabular-nums">
            {formatNumber(row.original.demand[3])} /{' '}
            <strong className="text-fg font-medium">{formatNumber(row.original.demand[6])}</strong>
          </span>
        ),
      },
      ...(canSeeCost
        ? [
            {
              id: 'price',
              header: t('Price'),
              meta: { align: 'right' },
              cell: ({ row }) => <span className="tabular-nums">{priceRange(row.original)}</span>,
            } satisfies TableColumn<Group>,
          ]
        : []),
    ],
    [locationName, showExpected, canSeeCost],
  )

  const title = noun.charAt(0).toUpperCase() + noun.slice(1)

  return (
    <ProductCatalogue
      rows={rows}
      storageKey={storageKey}
      ownFieldsTitle={`This ${noun}`}
      ownFields={[
        { id: 'atLocation', label: `At ${locationName}` },
        { id: 'everywhere', label: t('All locations') },
        ...(showExpected ? [{ id: 'expected', label: t('Expected') }] : []),
        { id: 'sales', label: t('Sold') },
        ...(canSeeCost ? [{ id: 'price', label: t('Price') }] : []),
      ]}
      defaultFields={[
        'variations',
        'atLocation',
        'everywhere',
        ...(showExpected ? ['expected'] : []),
        'sales',
        'price',
      ]}
      canSeeCost={canSeeCost}
      ownColumns={ownColumns}
      searchExtra={(row) => [row.supplierSku]}
      actions={actions}
      summary={summary}
      renderStats={(group, has) => (
        <>
          {has(t('atLocation')) || has('everywhere') ? (
            <div className="grid grid-cols-2 gap-1.5">
              {has(t('atLocation')) ? (
                <StockBox side="mine" label={`At ${locationName}`} units={atLocation(group)} />
              ) : null}
              {has('everywhere') ? (
                <StockBox side="theirs" label={t('All locations')} units={everywhere(group)} />
              ) : null}
            </div>
          ) : null}
          {(showExpected && has('expected')) || (canSeeCost && has('price')) ? (
            <dl className="text-2xs space-y-0.5">
              {showExpected && has('expected') && expected(group) > 0 ? (
                <div className="flex gap-2">
                  <dt className="text-fg-subtle">{t('Expected')}</dt>
                  <dd className="text-fg font-medium tabular-nums">
                    {formatNumber(expected(group))}
                  </dd>
                </div>
              ) : null}
              {canSeeCost && has('price') ? (
                <div className="flex gap-2">
                  <dt className="text-fg-subtle">{t('Price')}</dt>
                  <dd className="text-fg truncate font-medium tabular-nums">{priceRange(group)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </>
      )}
      renderSales={(group, has) =>
        has('sales') ? (
          <SalesFigures demand={group.demand} title={t('Sold, all locations')} />
        ) : null
      }
      renderDialog={(group, close) => (
        <VariationsDialog
          group={group}
          onClose={close}
          storageKey={`${storageKey}-product-variations`}
          canSeeCost={canSeeCost}
          initial={(row) => ({
            quantity: row.quantity,
            unitCost: row.unitCost,
            costCurrency: row.costCurrency,
          })}
          applyLabel={(alreadyOn) => (alreadyOn ? `Update the ${noun}` : `Add to ${noun}`)}
          onApply={onApply}
          stats={(open) => (
            <>
              <div className="min-w-32 flex-1">
                <StockBox large side="mine" label={`At ${locationName}`} units={atLocation(open)} />
              </div>
              <div className="min-w-32 flex-1">
                <StockBox large side="theirs" label={t('All locations')} units={everywhere(open)} />
              </div>
              <DialogStat
                label={t('Sold, 3 / 6 months')}
                value={`${formatNumber(open.demand[3])} / ${formatNumber(open.demand[6])}`}
              />
              <DialogStat label={t('Variations')} value={formatNumber(open.rows.length)} />
            </>
          )}
          columns={({ set }) => [
            {
              id: 'supplierSku',
              header: t('Their code'),
              cell: ({ row }) => (
                <span className="text-fg-muted text-2xs font-mono">
                  {row.original.row.supplierSku ?? '—'}
                </span>
              ),
            },
            {
              id: 'atLocation',
              header: `At ${locationName}`,
              meta: { align: 'right' },
              cell: ({ row }) => <StockPill side="mine" units={row.original.row.atLocation} />,
            },
            {
              id: 'everywhere',
              header: t('All locations'),
              meta: { align: 'right' },
              cell: ({ row }) => (
                <StockPill side="theirs" units={row.original.row.variation.stock} />
              ),
            },
            {
              id: 'sold',
              header: t('Sold, 3 / 6 mo'),
              meta: { align: 'right' },
              cell: ({ row }) => (
                <span className="text-fg-muted tabular-nums">
                  {formatNumber(row.original.row.demand[3])} /{' '}
                  <strong className="text-fg font-medium">
                    {formatNumber(row.original.row.demand[6])}
                  </strong>
                </span>
              ),
            },
            ...(showExpected
              ? [
                  {
                    id: 'expected',
                    header: t('Expected'),
                    meta: { align: 'right' },
                    cell: ({ row }) =>
                      row.original.row.expected === null
                        ? '—'
                        : formatNumber(row.original.row.expected),
                  } satisfies TableColumn<{ row: PurchaseRow; draft: VariationDraft }>,
                ]
              : []),
            ...(canSeeCost
              ? [
                  {
                    id: 'price',
                    header: t('Price'),
                    enableHiding: false,
                    meta: { align: 'right' },
                    cell: ({ row }) => (
                      <div className="flex items-center justify-end gap-1">
                        <NumberField
                          className="h-6 w-24 px-1.5 text-xs"
                          nullable={false}
                          min={0}
                          step="any"
                          aria-label={`Price of ${row.original.row.variation.fullName}`}
                          value={row.original.draft.unitCost}
                          onChange={(unitCost) =>
                            set(row.original.row, { unitCost: unitCost ?? 0 })
                          }
                        />
                        <Select
                          className="h-6 w-20 text-xs"
                          aria-label={`Currency of ${row.original.row.variation.fullName}`}
                          value={row.original.draft.costCurrency}
                          onChange={(costCurrency) =>
                            set(row.original.row, {
                              costCurrency: costCurrency as 'USD' | 'UZS',
                            })
                          }
                          options={CURRENCIES}
                        />
                      </div>
                    ),
                  } satisfies TableColumn<{ row: PurchaseRow; draft: VariationDraft }>,
                ]
              : []),
            {
              id: 'quantity',
              header: title === 'Receipt' ? 'Arrived' : 'Order',
              enableHiding: false,
              meta: { align: 'right' },
              cell: ({ row }) => (
                <QuantityStepper
                  value={row.original.draft.quantity}
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
