import { useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, Folder, LayoutGrid, Package, Search, Truck } from 'lucide-react'
import { Input } from '@/shared/ui/Input'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { t } from '@/shared/i18n'
import { useDataStore } from '@/data/store'
import {
  countByCategory,
  groupByProduct,
  type CatalogueRow,
} from '@/shared/components/catalogue/browse'

/** What the sidebar has narrowed the shelf to. */
export interface TillBrowse {
  mode: 'products' | 'trucks'
  categoryId: string | null
  make: string | null
  model: string | null
}

export const BROWSE_ALL: TillBrowse = {
  mode: 'products',
  categoryId: null,
  make: null,
  model: null,
}

interface Node {
  id: string
  name: string
  imageUrl?: string | null
  count: number
  children: Node[]
  /** What choosing this node sets. */
  pick: Omit<TillBrowse, 'mode'>
}

/**
 * The till's parts catalogue (client reference): two ways into the shelf,
 * «По товарам» — our categories and their sub-categories — and «По
 * автомобилям» — truck makes and their models, as Settings lists them. Only
 * what this shop actually has in stock is shown, with how many products.
 *
 * The search narrows the tree itself, not the products: it is for finding
 * "Бамперы" among forty categories, while the search above the results finds
 * a part by name or code.
 */
export function TillCatalogueSidebar({
  rows,
  value,
  onChange,
}: {
  rows: CatalogueRow[]
  value: TillBrowse
  onChange: (next: TillBrowse) => void
}) {
  const categories = useDataStore((s) => s.categorySettings)
  const vehicleMakes = useDataStore((s) => s.vehicleMakes)
  const [term, setTerm] = useState('')
  const [expanded, setExpanded] = useState<string[]>([])

  const groups = useMemo(() => groupByProduct(rows), [rows])

  const categoryTree = useMemo<Node[]>(() => {
    const counts = countByCategory(groups, categories)
    const build = (parentId: string | null): Node[] =>
      categories
        .filter((category) => category.parentId === parentId)
        .map((category) => ({
          id: category.id,
          name: category.name,
          imageUrl: category.imageUrl,
          count: counts.get(category.id) ?? 0,
          children: build(category.id),
          pick: { categoryId: category.id, make: null, model: null },
        }))
        .filter((node) => node.count > 0)
    return build(null)
  }, [groups, categories])

  const truckTree = useMemo<Node[]>(
    () =>
      vehicleMakes
        .map((make) => {
          const fitting = groups.filter((g) => g.vehicleMakes.includes(make.name))
          return {
            id: `make-${make.id}`,
            name: make.name,
            count: fitting.length,
            pick: { categoryId: null, make: make.name, model: null },
            children: make.models
              .map((model) => ({
                id: `model-${make.id}-${model.name}`,
                name: model.name,
                count: fitting.filter((g) => g.vehicleModels.includes(model.name)).length,
                children: [],
                pick: { categoryId: null, make: make.name, model: model.name },
              }))
              .filter((node) => node.count > 0),
          }
        })
        .filter((node) => node.count > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [vehicleMakes, groups],
  )

  const tree = value.mode === 'products' ? categoryTree : truckTree

  /** While searching, a branch shows when it or anything under it matches. */
  const q = term.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return tree
    const prune = (nodes: Node[]): Node[] =>
      nodes.flatMap((node) => {
        const children = prune(node.children)
        return node.name.toLowerCase().includes(q) || children.length ? [{ ...node, children }] : []
      })
    return prune(tree)
  }, [tree, q])

  const isSelected = (node: Node) =>
    node.pick.categoryId === value.categoryId &&
    node.pick.make === value.make &&
    node.pick.model === value.model

  const choose = (node: Node) => {
    onChange({ mode: value.mode, ...node.pick })
    if (node.children.length && !expanded.includes(node.id)) {
      setExpanded((current) => [...current, node.id])
    }
  }

  const toggle = (id: string) =>
    setExpanded((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )

  const everything = value.categoryId === null && value.make === null

  const renderNodes = (nodes: Node[], depth: number): ReactNode =>
    nodes.map((node) => {
      const open = Boolean(q) || expanded.includes(node.id)
      const selected = isSelected(node)
      return (
        <li key={node.id}>
          <div
            className={cn(
              'rounded-control flex items-center gap-1 pr-2 text-sm transition-colors',
              selected
                ? 'bg-primary text-primary-fg font-medium'
                : 'text-fg hover:bg-surface-muted',
            )}
          >
            {node.children.length ? (
              <button
                type="button"
                onClick={() => toggle(node.id)}
                aria-label={open ? t('Collapse') : t('Expand')}
                className="flex size-7 shrink-0 items-center justify-center"
              >
                <ChevronRight
                  className={cn('size-3.5 transition-transform', open && 'rotate-90')}
                />
              </button>
            ) : (
              <span className="size-7 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => choose(node)}
              aria-current={selected ? 'true' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
            >
              {depth === 0 ? (
                value.mode === 'trucks' ? (
                  <Truck className="size-4 shrink-0 opacity-70" />
                ) : node.imageUrl ? (
                  <img
                    src={node.imageUrl}
                    alt=""
                    className="size-5 shrink-0 rounded object-cover"
                  />
                ) : (
                  <Folder className="size-4 shrink-0 opacity-70" />
                )
              ) : null}
              <span className={cn('flex-1 truncate', depth === 0 && 'font-medium')}>
                {node.name}
              </span>
              <span
                className={cn(
                  'text-2xs tabular-nums',
                  selected ? 'text-primary-fg/80' : 'text-fg-subtle',
                )}
              >
                {formatNumber(node.count)}
              </span>
            </button>
          </div>
          {open && node.children.length ? (
            <ul className="border-border ml-3.5 border-l border-dashed pl-2">
              {renderNodes(node.children, depth + 1)}
            </ul>
          ) : null}
        </li>
      )
    })

  return (
    <aside className="border-border bg-surface flex min-h-0 flex-col border-r">
      <div className="space-y-3 p-3 pb-2">
        <h2 className="text-fg text-base font-semibold">{t('Parts catalogue')}</h2>
        <div className="bg-surface-inset rounded-control grid grid-cols-2 gap-1 p-1">
          {(
            [
              { mode: 'products', label: t('By products'), icon: <Package /> },
              { mode: 'trucks', label: t('By trucks'), icon: <Truck /> },
            ] as const
          ).map((entry) => (
            <button
              key={entry.mode}
              type="button"
              aria-pressed={value.mode === entry.mode}
              onClick={() => {
                if (value.mode === entry.mode) return
                // The two trees narrow by different things; switching starts over.
                onChange({ ...BROWSE_ALL, mode: entry.mode })
                setTerm('')
              }}
              className={cn(
                'rounded-control flex items-center justify-center gap-1.5 px-1.5 py-2 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
                value.mode === entry.mode
                  ? 'bg-primary text-primary-fg shadow-card'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {entry.icon}
              {entry.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t('Search the catalogue…')}
            aria-label={t('Search the catalogue')}
            className="pl-9"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        <li>
          <button
            type="button"
            onClick={() => onChange({ ...BROWSE_ALL, mode: value.mode })}
            className={cn(
              'rounded-control flex w-full items-center gap-2 py-1.5 pr-2 pl-2 text-left text-sm font-medium transition-colors',
              everything ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-surface-muted',
            )}
          >
            <LayoutGrid className="size-4 opacity-70" />
            <span className="flex-1">
              {value.mode === 'products' ? t('All products') : t('All trucks')}
            </span>
            <span className={cn('text-2xs tabular-nums', everything ? '' : 'text-fg-subtle')}>
              {formatNumber(groups.length)}
            </span>
          </button>
        </li>
        {renderNodes(visible, 0)}
        {visible.length === 0 ? (
          <li className="text-fg-subtle px-2 py-6 text-center text-sm">
            {t('Nothing in the catalogue matches')}
          </li>
        ) : null}
      </ul>
    </aside>
  )
}

/** The heading over the results: what the sidebar has narrowed to. */
export function browseTitle(
  browse: TillBrowse,
  categories: { id: string; name: string }[],
): string {
  if (browse.model) return `${browse.make} ${browse.model}`
  if (browse.make) return browse.make
  if (browse.categoryId)
    return categories.find((category) => category.id === browse.categoryId)?.name ?? ''
  return browse.mode === 'products' ? t('All products') : t('All trucks')
}
