import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Folder, LayoutGrid, Layers, List, Package, Plus, Search, Settings2 } from 'lucide-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ScrollSentinel } from '@/shared/components/ScrollSentinel'
import { useInfiniteRows } from '@/shared/hooks/useInfiniteRows'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Popover } from '@/shared/ui/Popover'
import { Select } from '@/shared/ui/Select'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import {
  childrenOf,
  countByCategory,
  groupByProduct,
  bestSellingFirst,
  matchesSearch,
  subtreeOf,
  type ProductGroup,
} from '../model/browse'
import { StockBox } from './StockBox'
import { CATALOGUE_CARD_FIELDS, type CatalogueCardField } from '../model/cardFields'
import { TransferProductModal } from './TransferProductModal'
import { TransferProductTable } from './TransferProductTable'
import type { TransferRow } from './transferLineColumns'

/* --- what a card shows ---------------------------------------------------- */

/** The transfer's own figures; everything else a card can show is a product-list field. */
type TransferCardField = 'variations' | 'atDestination' | 'atSource' | 'sales'
type CardField = TransferCardField | CatalogueCardField

const TRANSFER_CARD_FIELDS: { id: TransferCardField; label: (names: Names) => string }[] = [
  { id: 'variations', label: () => 'Variations' },
  { id: 'atDestination', label: (n) => `At ${n.to}` },
  { id: 'atSource', label: (n) => `At ${n.from}` },
  { id: 'sales', label: (n) => `Sold at ${n.demand}` },
]

/** The mockup's card, and nothing it did not have. */
const DEFAULT_CARD_FIELDS: CardField[] = ['variations', 'atDestination', 'atSource', 'sales']
/** The "no filter" value of a select, which cannot hold an empty string. */
const ALL = '__all__'
const CARD_FIELDS_KEY = 'transfer-card-fields'
const VIEW_KEY = 'transfer-catalogue-view'

interface Names {
  from: string
  to: string
  demand: string
  /**
   * Whose shelf is yours. Sending, it is the source; requesting, it is the
   * destination — and yours is the one whose stock is coloured by level.
   */
  requesting: boolean
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
  canSeeCost,
  onApply,
  actions,
}: {
  rows: TransferRow[]
  names: Names
  canSeeCost: boolean
  onApply: (changes: { row: TransferRow; quantity: number }[]) => void
  actions?: ReactNode
}) {
  const categories = useDataStore((s) => s.categorySettings)
  const vehicleMakes = useDataStore((s) => s.vehicleMakes)

  /** The category drilled into, root first. Empty means every product. */
  const [path, setPath] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [make, setMake] = useState(ALL)
  const [model, setModel] = useState(ALL)
  const [view, setView] = useState<'cards' | 'table'>(() => readStored(VIEW_KEY, 'cards'))
  const [fields, setFields] = useState<CardField[]>(() =>
    readStored(CARD_FIELDS_KEY, DEFAULT_CARD_FIELDS),
  )
  const [openId, setOpenId] = useState<string | null>(null)
  /** The slot beside the view switcher the list's Columns menu is drawn into. */
  const [columnsSlot, setColumnsSlot] = useState<HTMLElement | null>(null)

  const groups = useMemo(() => groupByProduct(rows), [rows])
  const counts = useMemo(() => countByCategory(groups, categories), [groups, categories])

  const current = path.at(-1) ?? null
  const stocked = (id: string | null) =>
    childrenOf(id, categories).filter((c) => (counts.get(c.id) ?? 0) > 0)
  const roots = stocked(null)
  /*
    One row of sub-categories under the categories for every level drilled
    into, so choosing never moves the picker down into the results — the
    products of whatever is selected are already showing beneath it.
  */
  const levels = path
    .map((id, depth) => ({ id, depth, children: stocked(id) }))
    .filter((level) => level.children.length > 0)

  const makes = useMemo(
    () => [...new Set(groups.flatMap((g) => g.vehicleMakes))].sort((a, b) => a.localeCompare(b)),
    [groups],
  )

  /**
   * The chosen make's models, as Settings lists them, that something on this
   * shelf actually fits. A product only records model names, not which make
   * each belongs to, so Settings is what ties a model to its make.
   */
  const models = useMemo(() => {
    if (make === ALL) return []
    const known = vehicleMakes.find((m) => m.name === make)?.models.map((m) => m.name) ?? []
    const fitted = new Set(
      groups.filter((g) => g.vehicleMakes.includes(make)).flatMap((g) => g.vehicleModels),
    )
    return known.filter((name) => fitted.has(name))
  }, [make, vehicleMakes, groups])

  const inCategory = useMemo(() => {
    const leaf = path.at(-1)
    const within = leaf ? subtreeOf(leaf, categories) : null
    return groups.filter((g) => !within || within.has(g.categoryId))
  }, [groups, path, categories])

  const matching = useMemo(
    () =>
      bestSellingFirst(
        inCategory.filter(
          (g) =>
            matchesSearch(g, search) &&
            (make === ALL || g.vehicleMakes.includes(make)) &&
            (model === ALL || g.vehicleModels.includes(model)),
        ),
      ),
    [inCategory, search, make, model],
  )

  const { visible, hasMore, shown, total, sentinel, showMore } = useInfiniteRows(matching)

  const chosenProducts = groups.filter((g) => g.chosen > 0).length
  const chosenUnits = groups.reduce((sum, g) => sum + g.chosen, 0)
  const open = openId ? (groups.find((g) => g.productId === openId) ?? null) : null
  const openGroup = useCallback((group: ProductGroup) => setOpenId(group.productId), [])

  const toggleField = (id: CardField, on: boolean) => {
    const order: CardField[] = [
      ...TRANSFER_CARD_FIELDS.map((f) => f.id),
      ...CATALOGUE_CARD_FIELDS.map((f) => f.id),
    ]
    const next = on
      ? order.filter((f) => f === id || fields.includes(f))
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
      <div className="-m-1 flex gap-2 overflow-x-auto p-1 pb-2">
        {roots.map((category) => (
          <CategoryTile
            key={category.id}
            active={path[0] === category.id}
            icon={<Layers />}
            imageUrl={category.imageUrl}
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

      {levels.map((level) => {
        const parent = categories.find((c) => c.id === level.id)
        return (
          <div
            key={level.id}
            className="border-primary-border bg-primary-soft/40 rounded-card flex gap-2 overflow-x-auto border border-dashed p-2"
          >
            <CategoryTile
              compact
              active={path.length === level.depth + 1}
              icon={<LayoutGrid />}
              name={`All in ${parent?.name ?? 'this category'}`}
              detail={`${formatNumber(counts.get(level.id) ?? 0)} products`}
              onClick={() => goTo(path.slice(0, level.depth + 1))}
            />
            {level.children.map((child) => (
              <CategoryTile
                key={child.id}
                compact
                active={path[level.depth + 1] === child.id}
                icon={<Folder />}
                imageUrl={child.imageUrl}
                name={child.name}
                detail={`${formatNumber(counts.get(child.id) ?? 0)} products`}
                onClick={() => goTo([...path.slice(0, level.depth + 1), child.id])}
              />
            ))}
          </div>
        )
      })}

      <div className="rounded-card border-border bg-surface shadow-card space-y-3 border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-fg-muted text-sm">
            <strong className="text-fg font-medium">{formatNumber(matching.length)}</strong>{' '}
            {matching.length === 1 ? 'product' : 'products'}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              className="w-40"
              aria-label="Make"
              value={make}
              onChange={(next) => {
                setMake(next)
                // A model belongs to one make; keeping it across a change of make
                // would filter on a pairing that cannot exist.
                setModel(ALL)
              }}
              options={[
                { value: ALL, label: 'All makes' },
                ...makes.map((m) => ({ value: m, label: m })),
              ]}
            />
            <Select
              className="w-40"
              aria-label="Model"
              value={model}
              onChange={setModel}
              disabled={make === ALL}
              options={[
                { value: ALL, label: make === ALL ? 'Pick a make first' : 'All models' },
                ...models.map((m) => ({ value: m, label: m })),
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
                aria-label="Show products as a list"
                aria-pressed={view === 'table'}
                onClick={() => {
                  setView('table')
                  store(VIEW_KEY, 'table')
                }}
              >
                <List />
              </Button>
            </div>
            {/* The list's Columns menu lands here, where the cards' Fields menu sits. */}
            {view === 'table' ? <div ref={setColumnsSlot} className="flex" /> : null}
            {view === 'cards' ? (
              <Popover
                align="end"
                className="max-h-[min(28rem,var(--radix-popover-content-available-height))] w-64 overflow-y-auto p-1"
                trigger={
                  <Button type="button" variant="ghost" size="sm">
                    <Settings2 />
                    Fields
                  </Button>
                }
              >
                <p className="text-fg-subtle text-2xs px-2 pt-1 pb-1.5">This transfer</p>
                {TRANSFER_CARD_FIELDS.map((field) => (
                  <FieldToggle
                    key={field.id}
                    label={field.label(names)}
                    checked={fields.includes(field.id)}
                    onChange={(checked) => toggleField(field.id, checked)}
                  />
                ))}
                <p className="text-fg-subtle text-2xs border-border mt-1 border-t px-2 pt-2 pb-1.5">
                  Product fields
                </p>
                {CATALOGUE_CARD_FIELDS.filter((field) => canSeeCost || !field.costOnly).map(
                  (field) => (
                    <FieldToggle
                      key={field.id}
                      label={field.label}
                      checked={fields.includes(field.id)}
                      onChange={(checked) => toggleField(field.id, checked)}
                    />
                  ),
                )}
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

      {view === 'table' ? (
        <TransferProductTable
          groups={visible}
          names={names}
          canSeeCost={canSeeCost}
          onOpen={openGroup}
          columnsMenuContainer={columnsSlot}
          footer={
            <ScrollSentinel
              ref={sentinel}
              hasMore={hasMore}
              shown={shown}
              total={total}
              onShowMore={showMore}
            />
          }
          emptyState={
            <EmptyState title="No products match" description="Try another make or model." />
          }
        />
      ) : matching.length === 0 ? (
        <div className="rounded-card border-border bg-surface border">
          <EmptyState
            title="No products match"
            description={
              current && search.trim()
                ? 'Only this category was searched.'
                : 'Try another make or model.'
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
                canSeeCost={canSeeCost}
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
        requesting={names.requesting}
        canSeeCost={canSeeCost}
        onApply={onApply}
      />
    </div>
  )
}

function CategoryTile({
  compact = false,
  active,
  icon,
  imageUrl,
  name,
  detail,
  onClick,
}: {
  /** A sub-category: the same tile, a size down. */
  compact?: boolean
  active: boolean
  icon: ReactNode
  /** The category's own picture, set in Settings → Categories. Falls back to `icon`. */
  imageUrl?: string | null
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
        'rounded-card bg-surface shadow-card flex shrink-0 items-center border text-left transition-colors',
        compact ? 'min-w-36 gap-2 p-1.5 pr-3' : 'min-w-44 gap-3 p-2.5 pr-4',
        active ? 'border-primary ring-primary ring-1' : 'border-border hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'rounded-control flex shrink-0 items-center justify-center overflow-hidden',
          compact ? 'size-7 [&_svg]:size-4' : 'size-10 [&_svg]:size-5',
          active ? 'bg-primary text-primary-fg' : 'bg-surface-inset text-fg-muted',
        )}
      >
        {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="text-fg block truncate text-sm font-medium">{name}</span>
        <span className="text-fg-subtle text-2xs block">{detail}</span>
      </span>
    </button>
  )
}

function FieldToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="text-fg hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
      <Checkbox aria-label={label} checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  )
}

function ProductCard({
  group,
  fields,
  names,
  canSeeCost,
  onOpen,
}: {
  group: ProductGroup
  fields: CardField[]
  names: Names
  canSeeCost: boolean
  onOpen: () => void
}) {
  const has = (field: CardField) => fields.includes(field)
  const first = group.rows[0]!.variation
  const variations = group.rows.map((row) => row.variation)
  const extras = CATALOGUE_CARD_FIELDS.filter(
    (field) => has(field.id) && (canSeeCost || !field.costOnly),
  ).map((field) => [field.label, field.value(variations)] as const)

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
        className="bg-surface-inset text-fg-subtle flex aspect-[3/2] items-center justify-center overflow-hidden"
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
            {/* Yours first, judged by level; theirs beside it, in blue. */}
            {(names.requesting
              ? [
                  ['atDestination', 'mine', names.to, group.atDestination] as const,
                  ['atSource', 'theirs', names.from, group.atSource] as const,
                ]
              : [
                  ['atSource', 'mine', names.from, group.atSource] as const,
                  ['atDestination', 'theirs', names.to, group.atDestination] as const,
                ]
            )
              .filter(([field]) => has(field))
              .map(([field, side, name, units]) => (
                <StockBox key={field} side={side} label={`At ${name}`} units={units} />
              ))}
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
