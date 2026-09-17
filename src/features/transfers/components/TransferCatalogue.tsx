import { useMemo, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  LayoutGrid,
  Layers,
  List,
  Package,
  Plus,
  Search,
  Settings2,
} from 'lucide-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ScrollSentinel } from '@/shared/components/ScrollSentinel'
import { useInfiniteRows } from '@/shared/hooks/useInfiniteRows'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Popover } from '@/shared/ui/Popover'
import { Select } from '@/shared/ui/Select'
import { cn } from '@/shared/lib/cn'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import {
  childrenOf,
  countByCategory,
  groupByProduct,
  matchesAvailability,
  matchesSearch,
  sortGroups,
  stockLevel,
  subtreeOf,
  type Availability,
  type ProductGroup,
  type SortBy,
} from '../model/browse'
import { TransferProductModal } from './TransferProductModal'
import type { TransferRow } from './transferLineColumns'

/* --- what a card shows ---------------------------------------------------- */

type CardField =
  | 'variations'
  | 'atDestination'
  | 'atSource'
  | 'sales'
  | 'vehicleMakes'
  | 'vehicleModels'
  | 'brandName'
  | 'manufacturer'
  | 'categoryPath'
  | 'sku'
  | 'shelfAddress'
  | 'salePrice'

const CARD_FIELDS: { id: CardField; label: (names: Names) => string }[] = [
  { id: 'variations', label: () => 'Variations' },
  { id: 'atDestination', label: (n) => `At ${n.to}` },
  { id: 'atSource', label: (n) => `At ${n.from}` },
  { id: 'sales', label: (n) => `Sold at ${n.demand}` },
  { id: 'vehicleMakes', label: () => 'Make' },
  { id: 'vehicleModels', label: () => 'Model' },
  { id: 'brandName', label: () => 'Supplier' },
  { id: 'manufacturer', label: () => 'Product brand' },
  { id: 'categoryPath', label: () => 'Category' },
  { id: 'sku', label: () => 'SKU' },
  { id: 'shelfAddress', label: () => 'Storage address' },
  { id: 'salePrice', label: () => 'Sale price' },
]

/** The mockup's card, and nothing it did not have. */
const DEFAULT_CARD_FIELDS: CardField[] = ['variations', 'atDestination', 'atSource', 'sales']
const CARD_FIELDS_KEY = 'transfer-card-fields'
const VIEW_KEY = 'transfer-catalogue-view'

interface Names {
  from: string
  to: string
  demand: string
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private windows refuse storage; the choice simply lasts this visit.
  }
}

/**
 * The sending shelf, browsed rather than scrolled: categories across the top,
 * sub-categories as folders, then a card per product — the client's mockup.
 *
 * It is a *view* over the same rows the table shows, not a second picker, so
 * the table stays one click away with its Columns menu, and a quantity set in
 * either is the same line on the transfer.
 */
export function TransferCatalogue({
  rows,
  names,
  demandLocationId,
  canSeeCost,
  onApply,
  renderTable,
  actions,
}: {
  rows: TransferRow[]
  names: Names
  demandLocationId: string | null
  canSeeCost: boolean
  onApply: (changes: { row: TransferRow; quantity: number }[]) => void
  /** The table view, given the rows the current category and filters leave. */
  renderTable: (rows: TransferRow[]) => ReactNode
  actions?: ReactNode
}) {
  const categories = useDataStore((s) => s.categorySettings)

  /** The category drilled into, root first. Empty means every product. */
  const [path, setPath] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [make, setMake] = useState('all')
  const [availability, setAvailability] = useState<Availability>('any')
  const [sortBy, setSortBy] = useState<SortBy>('sales')
  const [view, setView] = useState<'cards' | 'table'>(() => readStored(VIEW_KEY, 'cards'))
  const [fields, setFields] = useState<CardField[]>(() =>
    readStored(CARD_FIELDS_KEY, DEFAULT_CARD_FIELDS),
  )
  const [openId, setOpenId] = useState<string | null>(null)

  const groups = useMemo(() => groupByProduct(rows), [rows])
  const counts = useMemo(() => countByCategory(groups, categories), [groups, categories])
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c] as const)), [categories])

  const current = path.at(-1) ?? null
  const roots = childrenOf(null, categories).filter((c) => (counts.get(c.id) ?? 0) > 0)
  const folders = current
    ? childrenOf(current, categories).filter((c) => (counts.get(c.id) ?? 0) > 0)
    : []
  // A search looks inside the folders instead of stopping at them.
  const showFolders = folders.length > 0 && !search.trim()

  const makes = useMemo(
    () => [...new Set(groups.flatMap((g) => g.vehicleMakes))].sort((a, b) => a.localeCompare(b)),
    [groups],
  )

  const inCategory = useMemo(() => {
    const leaf = path.at(-1)
    const within = leaf ? subtreeOf(leaf, categories) : null
    return groups.filter((g) => !within || within.has(g.categoryId))
  }, [groups, path, categories])

  const matching = useMemo(
    () =>
      sortGroups(
        inCategory.filter(
          (g) =>
            matchesSearch(g, search) &&
            (make === 'all' || g.vehicleMakes.includes(make)) &&
            matchesAvailability(g, availability),
        ),
        sortBy,
      ),
    [inCategory, search, make, availability, sortBy],
  )

  const { visible, hasMore, shown, total, sentinel, showMore } = useInfiniteRows(matching)

  const chosenProducts = groups.filter((g) => g.chosen > 0).length
  const chosenUnits = groups.reduce((sum, g) => sum + g.chosen, 0)
  const open = openId ? (groups.find((g) => g.productId === openId) ?? null) : null

  const toggleField = (id: CardField, on: boolean) => {
    const next = on
      ? CARD_FIELDS.map((f) => f.id).filter((f) => f === id || fields.includes(f))
      : fields.filter((f) => f !== id)
    setFields(next)
    store(CARD_FIELDS_KEY, next)
  }

  const goTo = (next: string[]) => {
    setPath(next)
    setSearch('')
  }

  return (
    <div className="space-y-3">
      {/* Categories: always the top level, whatever is drilled into below. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {roots.map((category) => (
          <CategoryTile
            key={category.id}
            active={path[0] === category.id}
            icon={<Layers />}
            name={category.name}
            detail={`${formatNumber(counts.get(category.id) ?? 0)} products`}
            onClick={() => goTo([category.id])}
          />
        ))}
        <CategoryTile
          active={path.length === 0}
          icon={<LayoutGrid />}
          name="All categories"
          detail={`${formatNumber(groups.length)} products`}
          onClick={() => goTo([])}
        />
      </div>

      <div className="rounded-card border-border bg-surface shadow-card space-y-3 border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Category" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            <Crumb onClick={() => goTo([])} current={path.length === 0}>
              All products
            </Crumb>
            {path.map((id, depth) => (
              <span key={id} className="flex items-center gap-1">
                <ChevronRight className="text-fg-subtle size-3.5" aria-hidden />
                <Crumb
                  onClick={() => goTo(path.slice(0, depth + 1))}
                  current={depth === path.length - 1}
                >
                  {byId.get(id)?.name ?? id}
                </Crumb>
              </span>
            ))}
            <span className="text-fg-subtle text-2xs ml-2">
              {showFolders
                ? `${formatNumber(folders.length)} ${folders.length === 1 ? 'folder' : 'folders'}`
                : `${formatNumber(matching.length)} products`}
            </span>
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              className="w-36"
              aria-label="Make"
              value={make}
              onChange={setMake}
              options={[
                { value: 'all', label: 'All makes' },
                ...makes.map((m) => ({ value: m, label: m })),
              ]}
            />
            <Select<Availability>
              className="w-48"
              aria-label={`Stock at ${names.to}`}
              value={availability}
              onChange={setAvailability}
              options={[
                { value: 'any', label: 'Any stock' },
                { value: 'low', label: `Low at ${names.to}` },
                { value: 'none', label: `None at ${names.to}` },
              ]}
            />
            <Select<SortBy>
              className="w-40"
              aria-label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'sales', label: 'Best selling' },
                { value: 'stock', label: `Emptiest at ${names.to}` },
                { value: 'name', label: 'By name' },
              ]}
            />
            <div className="border-border rounded-control flex items-center border p-0.5">
              <Button
                type="button"
                variant={view === 'cards' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="Show products as cards"
                aria-pressed={view === 'cards'}
                onClick={() => {
                  setView('cards')
                  store(VIEW_KEY, 'cards')
                }}
              >
                <LayoutGrid />
              </Button>
              <Button
                type="button"
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="Show variations as a table"
                aria-pressed={view === 'table'}
                onClick={() => {
                  setView('table')
                  store(VIEW_KEY, 'table')
                }}
              >
                <List />
              </Button>
            </div>
            {view === 'cards' ? (
              <Popover
                align="end"
                className="max-h-80 w-60 overflow-y-auto p-1"
                trigger={
                  <Button type="button" variant="ghost" size="sm">
                    <Settings2 />
                    Fields
                  </Button>
                }
              >
                <p className="text-fg-subtle text-2xs px-2 pt-1 pb-1.5">Shown on each card</p>
                {CARD_FIELDS.map((field) => (
                  <label
                    key={field.id}
                    className="text-fg hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      aria-label={field.label(names)}
                      checked={fields.includes(field.id)}
                      onCheckedChange={(checked) => toggleField(field.id, checked)}
                    />
                    {field.label(names)}
                  </label>
                ))}
              </Popover>
            ) : null}
            {actions}
          </div>
        </div>

        <div className="relative">
          <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, SKU, OEM, barcode or storage address"
            aria-label="Search products"
          />
        </div>
      </div>

      {showFolders ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => goTo([...path, folder.id])}
              className="rounded-card border-border bg-surface shadow-card hover:border-primary group flex items-center gap-3 border p-3 text-left transition-colors"
            >
              <span className="bg-primary-soft text-primary rounded-control flex size-14 shrink-0 items-center justify-center">
                <Folder className="size-6 group-hover:hidden" />
                <FolderOpen className="hidden size-6 group-hover:block" />
              </span>
              <span className="min-w-0">
                <span className="text-fg block truncate text-sm font-medium">{folder.name}</span>
                <span className="text-fg-subtle text-2xs block">
                  {formatNumber(counts.get(folder.id) ?? 0)} products inside
                </span>
                <span className="text-primary text-2xs mt-1 inline-flex items-center gap-0.5 font-medium">
                  Open <ChevronRight className="size-3" />
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : view === 'table' ? (
        renderTable(matching.flatMap((g) => g.rows))
      ) : matching.length === 0 ? (
        <div className="rounded-card border-border bg-surface border">
          <EmptyState
            title="No products match"
            description={
              current && search.trim()
                ? 'Only this category was searched.'
                : 'Try another make, or any stock.'
            }
            action={
              current && search.trim() ? (
                <Button type="button" variant="secondary" onClick={() => setPath([])}>
                  Search every category
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
            {visible.map((group) => (
              <ProductCard
                key={group.productId}
                group={group}
                fields={fields}
                names={names}
                onOpen={() => setOpenId(group.productId)}
              />
            ))}
          </div>
          <ScrollSentinel
            ref={sentinel}
            hasMore={hasMore}
            shown={shown}
            total={total}
            onShowMore={showMore}
          />
        </>
      )}

      {/* What is on the transfer so far, wherever in the catalogue you are. */}
      <div className="border-border bg-surface shadow-card rounded-card sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 border px-4 py-3">
        <p className="text-fg-muted text-sm">
          Chosen:{' '}
          <strong className="text-fg font-medium">
            {formatNumber(chosenProducts)} {chosenProducts === 1 ? 'product' : 'products'}
          </strong>{' '}
          · <strong className="text-fg font-medium">{formatNumber(chosenUnits)}</strong> units
        </p>
      </div>

      <TransferProductModal
        group={open}
        onOpenChange={(next) => (next ? undefined : setOpenId(null))}
        fromName={names.from}
        toName={names.to}
        demandName={names.demand}
        demandLocationId={demandLocationId}
        canSeeCost={canSeeCost}
        onApply={onApply}
      />
    </div>
  )
}

function CategoryTile({
  active,
  icon,
  name,
  detail,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  name: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-card bg-surface shadow-card flex min-w-44 shrink-0 items-center gap-3 border p-2.5 pr-4 text-left transition-colors',
        active ? 'border-primary ring-primary ring-1' : 'border-border hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'rounded-control flex size-10 shrink-0 items-center justify-center [&_svg]:size-5',
          active ? 'bg-primary text-primary-fg' : 'bg-surface-inset text-fg-muted',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-fg block truncate text-sm font-medium">{name}</span>
        <span className="text-fg-subtle text-2xs block">{detail}</span>
      </span>
    </button>
  )
}

function Crumb({
  children,
  current,
  onClick,
}: {
  children: ReactNode
  current: boolean
  onClick: () => void
}) {
  return current ? (
    <span className="text-fg font-medium" aria-current="page">
      {children}
    </span>
  ) : (
    <button type="button" onClick={onClick} className="text-primary hover:underline">
      {children}
    </button>
  )
}

const LEVEL_STYLE = {
  critical: 'bg-danger-soft text-danger',
  low: 'bg-warning-soft text-warning',
  good: 'bg-success-soft text-success',
} as const

function ProductCard({
  group,
  fields,
  names,
  onOpen,
}: {
  group: ProductGroup
  fields: CardField[]
  names: Names
  onOpen: () => void
}) {
  const has = (field: CardField) => fields.includes(field)
  const first = group.rows[0]!.variation
  const unique = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => Boolean(v)))].join(', ') || '—'
  const prices = group.rows.map((row) => row.variation.salePrice)

  const extras: [string, string][] = [
    has('vehicleMakes') ? ['Make', group.vehicleMakes.join(', ') || '—'] : null,
    has('vehicleModels') ? ['Model', group.vehicleModels.join(', ') || '—'] : null,
    has('brandName') ? ['Supplier', group.brandName ?? '—'] : null,
    has('manufacturer') ? ['Product brand', group.manufacturer ?? '—'] : null,
    has('categoryPath') ? ['Category', group.categoryPath] : null,
    has('sku') ? ['SKU', unique(group.rows.map((r) => r.variation.sku))] : null,
    has('shelfAddress')
      ? ['Storage address', unique(group.rows.map((r) => r.variation.shelfAddress))]
      : null,
    has('salePrice')
      ? [
          'Sale price',
          Math.min(...prices) === Math.max(...prices)
            ? formatMoney(prices[0]!)
            : `${formatMoney(Math.min(...prices))} – ${formatMoney(Math.max(...prices))}`,
        ]
      : null,
  ].filter((entry): entry is [string, string] => entry !== null)

  return (
    <article
      className={cn(
        'rounded-card bg-surface shadow-card flex flex-col overflow-hidden border',
        group.chosen > 0 ? 'border-primary' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="bg-surface-inset text-fg-subtle flex aspect-[5/2] items-center justify-center"
        aria-label={`Open ${group.productName}`}
      >
        {first.imageUrl ? (
          <img src={first.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <Package className="size-8" aria-hidden />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="text-fg line-clamp-2 text-sm font-medium" title={group.productName}>
            {group.productName}
          </h3>
          {has('variations') ? (
            <p className="text-fg-subtle text-2xs mt-0.5">
              {formatNumber(group.rows.length)}{' '}
              {group.rows.length === 1 ? 'variation' : 'variations'}
            </p>
          ) : null}
        </div>

        {has('atDestination') || has('atSource') ? (
          <div className="grid grid-cols-2 gap-1.5">
            {has('atDestination') ? (
              <div
                className={cn(
                  'rounded-control px-2 py-1.5',
                  LEVEL_STYLE[stockLevel(group.atDestination)],
                )}
              >
                <p className="text-2xs truncate opacity-80">At {names.to}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatNumber(group.atDestination)}
                </p>
              </div>
            ) : null}
            {has('atSource') ? (
              <div className="rounded-control bg-surface-muted text-fg px-2 py-1.5">
                <p className="text-2xs text-fg-subtle truncate">At {names.from}</p>
                <p className="text-sm font-semibold tabular-nums">{formatNumber(group.atSource)}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {extras.length ? (
          <dl className="text-2xs space-y-0.5">
            {extras.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="text-fg-subtle shrink-0">{label}</dt>
                <dd className="text-fg truncate" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          {has('sales') ? (
            <div className="text-2xs text-fg-subtle flex gap-3" title={`Sold at ${names.demand}`}>
              <span>
                3 months
                <strong className="text-fg block text-sm font-semibold tabular-nums">
                  {formatNumber(group.demand[3])}
                </strong>
              </span>
              <span>
                6 months
                <strong className="text-fg block text-sm font-semibold tabular-nums">
                  {formatNumber(group.demand[6])}
                </strong>
              </span>
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            {group.chosen > 0 ? (
              <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
                {formatNumber(group.chosen)}
              </span>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="icon"
              aria-label={`Choose variations of ${group.productName}`}
              onClick={onOpen}
            >
              <Plus />
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}
