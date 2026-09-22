import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react'
import { Folder, LayoutGrid, Layers, List, Plus, Search, Settings2 } from 'lucide-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ScrollSentinel } from '@/shared/components/ScrollSentinel'
import type { TableColumn } from '@/shared/components/table/features'
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
  bestSellingFirst,
  childrenOf,
  countByCategory,
  groupByProduct,
  matchesSearch,
  subtreeOf,
  type CatalogueRow,
  type ProductGroup,
} from './browse'
import { CATALOGUE_CARD_FIELDS } from './cardFields'
import { PhotoStrip } from './PhotoStrip'
import { photosOf } from './browse'
import { ProductGroupTable } from './ProductGroupTable'
import { t, tn } from '@/shared/i18n'

/** The "no filter" value of a select, which cannot hold an empty string. */
const ALL = '__all__'

/** A figure of the document's own that a card can show, beside the product-list fields. */
export interface OwnCardField {
  id: string
  label: string
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
 * The product step of a document, browsed rather than scrolled: categories
 * across the top, sub-categories in a row beneath, then a card per product —
 * the client's mockup, first built for transfers and shared by orders and goods
 * receipts so the three pick products the same way.
 *
 * Cards and the list are two views over the same rows, and both open the same
 * dialog to choose variations in, so a quantity set in either is the same line
 * on the document. What each document adds — its own stock figures, its price,
 * its dialog — comes in through the props.
 */
export function ProductCatalogue<R extends CatalogueRow>({
  rows,
  storageKey,
  ownFieldsTitle,
  ownFields,
  defaultFields,
  listFieldsShown = ['categoryPath', 'vehicleMakes'],
  canSeeCost,
  renderStats,
  renderSales,
  ownColumns,
  searchExtra,
  actions,
  summary,
  renderDialog,
  onQuickAdd,
  showChosen = true,
  renderRow,
  renderPhotoBadge,
  browse,
  tools,
}: {
  rows: R[]
  /** Prefix for what this document remembers per browser: view, card fields, list columns. */
  storageKey: string
  /** Heading over the document's own fields in the Fields menu — "This order". */
  ownFieldsTitle: string
  /** The document's own card fields. "Variations" is always offered first. */
  ownFields: OwnCardField[]
  /** What a card shows until somebody changes it. */
  defaultFields: string[]
  /** Product-list fields visible in the list view until somebody changes it. */
  listFieldsShown?: string[]
  canSeeCost: boolean
  /** The document's stock boxes on a card, given which fields are switched on. */
  renderStats?: (group: ProductGroup<R>, has: (id: string) => boolean) => ReactNode
  /** Bottom left of a card, beside the + — sales, usually. */
  renderSales?: (group: ProductGroup<R>, has: (id: string) => boolean) => ReactNode
  /** The document's own columns in the list view, after the product name. */
  ownColumns: TableColumn<ProductGroup<R>>[]
  /** What else a row can be searched by, such as a supplier's own code. */
  searchExtra?: (row: R) => (string | null | undefined)[]
  /** Buttons beside the Fields menu — Suggest, Add products. */
  actions?: ReactNode
  /** Extra figures in the sticky footer, after what is chosen. */
  summary?: ReactNode
  /** The dialog a card's + opens; `group` is null while none is open. */
  renderDialog: (group: ProductGroup<R> | null, close: () => void) => ReactNode
  /**
   * Handles a + on its own, without the dialog, when it returns true — the
   * till adds a product with a single variation straight to the cart.
   */
  onQuickAdd?: (group: ProductGroup<R>) => boolean
  /** The sticky "Chosen" bar. Off where the screen shows its own cart. */
  showChosen?: boolean
  /**
   * The list view as a stack of the screen's own wide rows, in place of the
   * table — the till's list (client request). Cards stay the standard cards.
   */
  renderRow?: (group: ProductGroup<R>, open: () => void) => ReactNode
  /**
   * The category, make and model chosen somewhere else — the till's catalogue
   * sidebar. The catalogue then draws neither its category tiles nor its make
   * and model selects, and heads the results with `title` instead.
   */
  browse?: { categoryId: string | null; make: string | null; model: string | null; title: string }
  /** The screen's own filters, just before the view switcher — the till's make and model. */
  tools?: ReactNode
  /** A small label over a card's photo — «Новинка» on a purchase document. */
  renderPhotoBadge?: (group: ProductGroup<R>) => ReactNode
}) {
  const categories = useDataStore((s) => s.categorySettings)
  const vehicleMakes = useDataStore((s) => s.vehicleMakes)

  const fieldsKey = `${storageKey}-card-fields`
  const viewKey = `${storageKey}-catalogue-view`

  /** The category drilled into, root first. Empty means every product. */
  const [path, setPath] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [make, setMake] = useState(ALL)
  const [model, setModel] = useState(ALL)
  const [view, setView] = useState<'cards' | 'table'>(() => readStored(viewKey, 'cards'))
  const [fields, setFields] = useState<string[]>(() => readStored(fieldsKey, defaultFields))
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
   * The chosen make's models, as Settings lists them, that something on offer
   * actually fits. A product only records model names, not which make each
   * belongs to, so Settings is what ties a model to its make.
   */
  const models = useMemo(() => {
    if (make === ALL) return []
    const known = vehicleMakes.find((m) => m.name === make)?.models.map((m) => m.name) ?? []
    const fitted = new Set(
      groups.filter((g) => g.vehicleMakes.includes(make)).flatMap((g) => g.vehicleModels),
    )
    return known.filter((name) => fitted.has(name))
  }, [make, vehicleMakes, groups])

  // Chosen here, or handed in by a sidebar that does the choosing.
  const leafId = browse ? browse.categoryId : (path.at(-1) ?? null)
  const makeFilter = browse ? (browse.make ?? ALL) : make
  const modelFilter = browse ? (browse.model ?? ALL) : model

  const inCategory = useMemo(() => {
    const within = leafId ? subtreeOf(leafId, categories) : null
    return groups.filter((g) => !within || within.has(g.categoryId))
  }, [groups, leafId, categories])

  const matching = useMemo(
    () =>
      bestSellingFirst(
        inCategory.filter(
          (g) =>
            matchesSearch(g, search, searchExtra) &&
            (makeFilter === ALL || g.vehicleMakes.includes(makeFilter)) &&
            (modelFilter === ALL || g.vehicleModels.includes(modelFilter)),
        ),
      ),
    [inCategory, search, searchExtra, makeFilter, modelFilter],
  )

  const { visible, hasMore, shown, total, sentinel, showMore } = useInfiniteRows(matching)

  const chosenProducts = groups.filter((g) => g.chosen > 0).length
  const chosenUnits = groups.reduce((sum, g) => sum + g.chosen, 0)
  const open = openId ? (groups.find((g) => g.productId === openId) ?? null) : null
  const openGroup = useCallback(
    (group: ProductGroup<R>) => {
      if (onQuickAdd?.(group)) return
      setOpenId(group.productId)
    },
    [onQuickAdd],
  )
  const close = useCallback(() => setOpenId(null), [])

  const allOwn: OwnCardField[] = [{ id: 'variations', label: t('Variations') }, ...ownFields]
  const has = (id: string) => fields.includes(id)

  const toggleField = (id: string, on: boolean) => {
    const order = [...allOwn.map((f) => f.id), ...CATALOGUE_CARD_FIELDS.map((f) => f.id)]
    const next = on
      ? order.filter((f) => f === id || fields.includes(f))
      : fields.filter((f) => f !== id)
    setFields(next)
    store(fieldsKey, next)
  }

  const goTo = (next: string[]) => {
    setPath(next)
    setSearch('')
  }

  const chooseView = (next: 'cards' | 'table') => {
    setView(next)
    store(viewKey, next)
  }

  return (
    <div className="space-y-3">
      {/* Categories: always the top level, whatever is drilled into below. */}
      {browse ? null : (
        <div className="scroll-x-quiet -m-1 flex gap-2 overflow-x-auto p-1 pb-2">
          {roots.map((category) => (
            <CategoryTile
              key={category.id}
              active={path[0] === category.id}
              icon={<Layers />}
              imageUrl={category.imageUrl}
              name={category.name}
              detail={t('{count} products', { count: formatNumber(counts.get(category.id) ?? 0) })}
              onClick={() => goTo([category.id])}
            />
          ))}
          <CategoryTile
            active={path.length === 0}
            icon={<LayoutGrid />}
            name={t('All categories')}
            detail={t('{count} products', { count: formatNumber(groups.length) })}
            onClick={() => goTo([])}
          />
        </div>
      )}

      {(browse ? [] : levels).map((level) => {
        const parent = categories.find((c) => c.id === level.id)
        return (
          <div
            key={level.id}
            className="border-primary-border bg-primary-soft/40 rounded-card scroll-x-quiet flex gap-2 overflow-x-auto border border-dashed p-2"
          >
            <CategoryTile
              compact
              active={path.length === level.depth + 1}
              icon={<LayoutGrid />}
              name={t('All in {category}', { category: parent?.name ?? t('this category') })}
              detail={t('{count} products', { count: formatNumber(counts.get(level.id) ?? 0) })}
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
                detail={t('{count} products', { count: formatNumber(counts.get(child.id) ?? 0) })}
                onClick={() => goTo([...path.slice(0, level.depth + 1), child.id])}
              />
            ))}
          </div>
        )
      })}

      <div className="rounded-card border-border bg-surface shadow-card space-y-3 border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {browse ? (
            <h2 className="text-fg text-lg font-semibold">
              {browse.title}{' '}
              <span className="text-fg-muted text-sm font-normal">
                ({formatNumber(matching.length)} {tn(matching.length, 'product', 'products')})
              </span>
            </h2>
          ) : (
            <p className="text-fg-muted text-sm">
              <strong className="text-fg font-medium">{formatNumber(matching.length)}</strong>{' '}
              {tn(matching.length, 'product', 'products')}
            </p>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {browse ? null : (
              <>
                <Select
                  className="w-40"
                  aria-label={t('Make')}
                  value={make}
                  onChange={(next) => {
                    setMake(next)
                    // A model belongs to one make; keeping it across a change of make
                    // would filter on a pairing that cannot exist.
                    setModel(ALL)
                  }}
                  options={[
                    { value: ALL, label: t('All makes') },
                    ...makes.map((m) => ({ value: m, label: m })),
                  ]}
                />
                <Select
                  className="w-40"
                  aria-label={t('Model')}
                  value={model}
                  onChange={setModel}
                  disabled={make === ALL}
                  options={[
                    { value: ALL, label: make === ALL ? t('Pick a make first') : t('All models') },
                    ...models.map((m) => ({ value: m, label: m })),
                  ]}
                />
              </>
            )}
            {tools}
            <div className="border-border rounded-control flex items-center border p-0.5">
              <Button
                type="button"
                variant={view === 'cards' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t('Show products as cards')}
                aria-pressed={view === 'cards'}
                onClick={() => chooseView('cards')}
              >
                <LayoutGrid />
              </Button>
              <Button
                type="button"
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label={t('Show products as a list')}
                aria-pressed={view === 'table'}
                onClick={() => chooseView('table')}
              >
                <List />
              </Button>
            </div>
            {/* The list's Columns menu lands here, where the cards' Fields menu sits. */}
            {view === 'table' && !renderRow ? <div ref={setColumnsSlot} className="flex" /> : null}
            {view === 'cards' ? (
              <Popover
                align="end"
                className="max-h-[min(28rem,var(--radix-popover-content-available-height))] w-64 overflow-y-auto p-1"
                trigger={
                  <Button type="button" variant="ghost" size="sm">
                    <Settings2 />
                    {t('Fields')}
                  </Button>
                }
              >
                <p className="text-fg-subtle text-2xs px-2 pt-1 pb-1.5">{ownFieldsTitle}</p>
                {allOwn.map((field) => (
                  <FieldToggle
                    key={field.id}
                    label={field.label}
                    checked={has(field.id)}
                    onChange={(checked) => toggleField(field.id, checked)}
                  />
                ))}
                <p className="text-fg-subtle text-2xs border-border mt-1 border-t px-2 pt-2 pb-1.5">
                  {t('Product fields')}
                </p>
                {CATALOGUE_CARD_FIELDS.filter((field) => canSeeCost || !field.costOnly).map(
                  (field) => (
                    <FieldToggle
                      key={field.id}
                      label={field.label}
                      checked={has(field.id)}
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
            placeholder={t('Name, SKU, OEM, barcode or storage address')}
            aria-label={t('Search products')}
          />
        </div>
      </div>

      {view === 'table' && !renderRow ? (
        <ProductGroupTable
          storageKey={`${storageKey}-products`}
          groups={visible}
          ownColumns={ownColumns}
          listFieldsShown={listFieldsShown}
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
            <EmptyState
              title={t('No products match')}
              description={t('Try another make or model.')}
            />
          }
        />
      ) : matching.length === 0 ? (
        <div className="rounded-card border-border bg-surface border">
          <EmptyState
            title={t('No products match')}
            description={
              current && search.trim()
                ? t('Only this category was searched.')
                : t('Try another make or model.')
            }
            action={
              current && search.trim() ? (
                <Button type="button" variant="secondary" onClick={() => setPath([])}>
                  {t('Search every category')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div
            className={
              view === 'table'
                ? 'space-y-2'
                : 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3'
            }
          >
            {visible.map((group) =>
              view === 'table' && renderRow ? (
                <Fragment key={group.productId}>
                  {renderRow(group, () => openGroup(group))}
                </Fragment>
              ) : (
                <ProductCard
                  key={group.productId}
                  group={group}
                  has={has}
                  canSeeCost={canSeeCost}
                  renderStats={renderStats}
                  renderSales={renderSales}
                  badge={renderPhotoBadge?.(group)}
                  onOpen={() => openGroup(group)}
                />
              ),
            )}
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

      {/* What is on the document so far, wherever in the catalogue you are. */}
      {showChosen ? (
        <div className="border-border bg-surface shadow-card rounded-card sticky bottom-3 z-10 flex flex-wrap items-center gap-x-8 gap-y-1 border px-4 py-3">
          <p className="text-fg-muted text-sm">
            {t('Chosen:')}{' '}
            <strong className="text-fg font-medium">
              {formatNumber(chosenProducts)} {tn(chosenProducts, 'product', 'products')}
            </strong>{' '}
            · <strong className="text-fg font-medium">{formatNumber(chosenUnits)}</strong>{' '}
            {t('units')}
          </p>
          {summary}
        </div>
      ) : null}

      {renderDialog(open, close)}
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

function ProductCard<R extends CatalogueRow>({
  group,
  has,
  canSeeCost,
  renderStats,
  renderSales,
  badge,
  onOpen,
}: {
  group: ProductGroup<R>
  has: (id: string) => boolean
  canSeeCost: boolean
  /** Drawn over the top-left of the photo. */
  badge?: ReactNode
  renderStats?: (group: ProductGroup<R>, has: (id: string) => boolean) => ReactNode
  renderSales?: (group: ProductGroup<R>, has: (id: string) => boolean) => ReactNode
  onOpen: () => void
}) {
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
      <div className="relative">
        <PhotoStrip
          photos={photosOf(group)}
          label={group.productName}
          onOpen={onOpen}
          className="aspect-[3/2]"
        />
        {badge ? <div className="absolute top-1.5 left-1.5">{badge}</div> : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="text-fg line-clamp-2 text-sm font-medium" title={group.productName}>
            {group.productName}
          </h3>
          {has('variations') ? (
            <p className="text-fg-subtle text-2xs mt-0.5">
              {formatNumber(group.rows.length)} {tn(group.rows.length, 'variation', 'variations')}
            </p>
          ) : null}
        </div>

        {renderStats?.(group, has)}

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
          {renderSales?.(group, has) ?? <span />}
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
              aria-label={t('Choose variations of {productName}', {
                productName: group.productName,
              })}
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

/** Sold over 3 and 6 months, as the bottom left of a card shows it. */
export function SalesFigures({
  demand,
  title,
}: {
  demand: { 3: number; 6: number }
  title: string
}) {
  return (
    <div className="text-2xs text-fg-subtle flex gap-3" title={title}>
      <span>
        {t('3 months')}
        <strong className="text-fg block text-sm font-semibold tabular-nums">
          {formatNumber(demand[3])}
        </strong>
      </span>
      <span>
        {t('6 months')}
        <strong className="text-fg block text-sm font-semibold tabular-nums">
          {formatNumber(demand[6])}
        </strong>
      </span>
    </div>
  )
}
