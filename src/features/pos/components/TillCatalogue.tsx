import { useMemo } from 'react'
import { Link } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import { MoreVertical, Package, ShoppingCart } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { paths } from '@/shared/config/paths'
import { stockLevel } from '@/shared/components/catalogue/browse'
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
import { t, tn } from '@/shared/i18n'

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
  browse,
}: {
  rows: TillRow[]
  locationName: string
  /** One more of a product that has a single variation. */
  onAdd: (row: TillRow) => void
  /** Quantities set in the variations dialog. */
  onSet: (changes: { row: TillRow; quantity: number }[]) => void
  /** What the catalogue sidebar has narrowed the shelf to. */
  browse: { categoryId: string | null; make: string | null; model: string | null; title: string }
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
      browse={browse}
      renderCard={(group, open) => (
        <TillCard group={group} locationName={locationName} onOpen={open} />
      )}
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

/** The cheapest price, as a shop quotes a part that comes in several versions. */
function fromPrice(group: Group) {
  const prices = group.rows.map((row) => row.variation.salePrice)
  const low = Math.min(...prices)
  return prices.some((value) => value !== low)
    ? t('from {price}', { price: formatMoney(low) })
    : formatMoney(low)
}

const STOCK_TONE = { critical: 'text-danger', low: 'text-caution', good: 'text-success' } as const

/** Each value once, in order — a product's variations often share an OEM or a shelf. */
const distinct = (values: (string | null | undefined)[]) => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
]

/** The first value, and how many more there are. */
const firstOf = (values: string[]) =>
  values.length === 0
    ? '—'
    : values.length === 1
      ? values[0]!
      : `${values[0]} +${values.length - 1}`

/**
 * A product on the till, as a wide row — the client's reference: what the part
 * is on the left, whether it is here and where on the shelf in the middle, the
 * price and the cart button on the right. A cashier reads a row left to right
 * the way they answer a customer: which part, do we have it, how much.
 */
function TillCard({
  group,
  locationName,
  onOpen,
}: {
  group: Group
  locationName: string
  onOpen: () => void
}) {
  const first = group.rows[0]!.variation
  const variations = group.rows.map((row) => row.variation)
  const units = here(group)
  const skus = distinct(variations.map((v) => v.sku))
  const oems = distinct(variations.map((v) => v.oem))
  const shelves = distinct(variations.map((v) => v.shelfAddress))
  const brand = first.manufacturer ?? first.brandName

  return (
    <article
      className={cn(
        'rounded-card bg-surface shadow-card flex items-stretch gap-4 border p-3',
        group.chosen > 0 ? 'border-primary' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('Open {productName}', { productName: group.productName })}
        className="rounded-control bg-surface-inset text-fg-subtle flex aspect-[3/2] w-28 shrink-0 items-center justify-center self-center overflow-hidden"
      >
        {first.imageUrl ? (
          <img src={first.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <Package className="size-6" aria-hidden />
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-0.5 self-center">
        <h3 className="text-fg line-clamp-2 font-semibold" title={group.productName}>
          {group.productName}
        </h3>
        <p className="text-fg-muted text-sm">
          {t('SKU')}: <span className="text-fg font-mono text-xs">{firstOf(skus)}</span>
        </p>
        <p className="text-fg-muted text-sm">
          OEM: <span className="text-fg font-mono text-xs">{firstOf(oems)}</span>
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {brand ? (
            <span className="bg-primary-soft text-primary rounded px-2 py-0.5 text-xs font-semibold">
              {brand}
            </span>
          ) : null}
          {group.vehicleMakes.slice(0, 3).map((make) => (
            <span
              key={make}
              className="bg-surface-inset text-fg-muted rounded px-2 py-0.5 text-xs font-medium uppercase"
            >
              {make}
            </span>
          ))}
          {group.rows.length > 1 ? (
            <span className="border-border text-fg-muted rounded border px-2 py-0.5 text-xs">
              {formatNumber(group.rows.length)} {tn(group.rows.length, 'variation', 'variations')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-border w-56 shrink-0 space-y-1 self-center border-l pl-4 text-sm 2xl:w-64">
        <p className={cn('flex items-center gap-1.5 font-medium', STOCK_TONE[stockLevel(units)])}>
          <span className="size-2.5 shrink-0 rounded-full border-2 border-current" aria-hidden />
          {t('In stock: {count} {unit}', { count: formatNumber(units), unit: t(first.unit) })}
        </p>
        <p className="text-fg-muted truncate">
          {t('Location')}: <span className="text-fg">{locationName}</span>
        </p>
        <p className="text-fg-muted truncate">
          {t('Cell')}: <span className="text-fg font-mono text-xs">{firstOf(shelves)}</span>
        </p>
      </div>

      <div className="border-border w-44 shrink-0 self-center border-l pl-4">
        <p className="text-fg text-lg leading-tight font-semibold tabular-nums">
          {fromPrice(group)}
        </p>
        <p className="text-fg-subtle text-xs">/ {t(first.unit)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="relative">
          <Button
            type="button"
            variant="primary"
            className="size-12 p-0 [&_svg]:size-5"
            aria-label={t('Choose variations of {productName}', {
              productName: group.productName,
            })}
            onClick={onOpen}
          >
            <ShoppingCart />
          </Button>
          {group.chosen > 0 ? (
            <span className="bg-fg text-fg-inverted absolute -top-1.5 -right-1.5 min-w-5 rounded-full px-1 text-center text-xs font-semibold tabular-nums">
              {formatNumber(group.chosen)}
            </span>
          ) : null}
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={t('More actions')}>
              <MoreVertical />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="rounded-control border-border bg-surface shadow-popover z-50 min-w-48 border p-1"
            >
              <DropdownMenu.Item asChild>
                <Link
                  to={paths.products.detail(group.productId)}
                  target="_blank"
                  className="text-fg data-[highlighted]:bg-surface-muted flex rounded px-2 py-1.5 text-sm outline-none"
                >
                  {t('Open the product card')}
                </Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </article>
  )
}
