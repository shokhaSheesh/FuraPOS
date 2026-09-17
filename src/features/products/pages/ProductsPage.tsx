import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronDown, Download, FileUp, LayoutGrid, List, PencilLine, Plus } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { FilterSearch } from '@/shared/components/FilterSearch'
import { decodeFilters, encodeFilters } from '@/shared/lib/fieldFilters'
import { useDataStore } from '@/data/store'
import { productFilterFields } from '../model/productFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { TablePagination } from '@/shared/components/TablePagination'
import { ProductCardGrid } from '../components/ProductCardGrid'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { downloadCsv } from '@/shared/lib/csv'
import {
  PRODUCT_LIST_VIEWS,
  productListView,
  productRowId,
  useDeleteVariation,
  useLocations,
  useVariations,
} from '../api/products'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import {
  buildProductColumns,
  PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/productColumns'
import { ImportProductsModal } from '../components/ImportProductsModal'
import { effectivePrice, type VariationRow } from '../model/product'

/**
 * The catalogue. Reference implementation of the list-page pattern: PageHeader
 * (title, filters, one primary action) → summary strip → DataTable.
 *
 * It carries a lot of columns because an auto-parts catalogue genuinely needs
 * them — which vehicle a part fits, which shelf it sits on, what it cost in
 * USD — so most start hidden and the Columns control brings them back.
 */
export default function ProductsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()

  // The catalogue lists variations, full stop: a variation is what carries a
  // price, a barcode and stock, so it is what can be sold, counted or picked.
  const view = productListView(query.view)
  const { data, isLoading } = useVariations(query)
  const { data: locationData } = useLocations()
  const locationId = (query.location as string | null) ?? null
  const location = locationData.items.find((item) => item.id === locationId)
  const deleteVariation = useDeleteVariation()

  const [pendingDelete, setPendingDelete] = useState<VariationRow | null>(null)
  const [importing, setImporting] = useState(false)
  /** Table or boxes — a per-person preference, so it is remembered in this browser. */
  const [display, setDisplay] = useState<'table' | 'cards'>(() => {
    try {
      return localStorage.getItem('products-display') === 'cards' ? 'cards' : 'table'
    } catch {
      return 'table'
    }
  })
  const chooseDisplay = (next: 'table' | 'cards') => {
    setDisplay(next)
    try {
      localStorage.setItem('products-display', next)
    } catch {
      // Private windows refuse storage; the choice lasts this visit.
    }
  }

  const columns = useMemo(
    () =>
      buildProductColumns({
        canSeeCost: can('products.cost.view'),
        canEdit: can('products.list.edit'),
        canDelete: can('products.list.delete'),
        onEdit: (variation) => navigate(paths.products.detail(variation.productId)),
        onDelete: setPendingDelete,
        // A column per location, off until picked from Columns. Pointless once
        // the list is split or filtered by location: Quantity already is that.
        stockColumnsFor: view === 'variations' && !locationId ? locationData.items : [],
      }),
    [can, navigate, view, locationId, locationData.items],
  )

  /*
    Each view remembers its own columns. By location has to show Location —
    it is the whole point of the view.
  */
  const hidden = useMemo(
    () =>
      view === 'location'
        ? PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT.filter((id) => id !== 'location')
        : [
            ...PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT,
            ...locationData.items.map((item) => `stockAt:${item.id}`),
          ],
    [view, locationData.items],
  )

  const allVariations = useDataStore((s) => s.variations)
  const filterFields = useMemo(
    () =>
      productFilterFields(allVariations, {
        canSeeCost: can('products.cost.view'),
        locations: locationData.items,
      }),
    [allVariations, can, locationData.items],
  )
  const fieldFilters = useMemo(() => decodeFilters(query.f), [query.f])

  const isFiltered = Boolean(
    query.search || query.status || query.stock || query.location || query.f,
  )

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteVariation.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`${pendingDelete.name} deleted`)
        setPendingDelete(null)
      },
    })
  }

  const exportCsv = () => {
    const rows = data?.items ?? []
    if (!rows.length) return toast.error('Nothing to export with these filters')
    downloadCsv(
      `products-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'SKU',
        'Barcode',
        'Name',
        'Brand',
        'Category',
        'Make',
        'Model',
        'Location',
        'Stock',
        'Cost',
        'Currency',
        'Price',
        'Status',
      ],
      rows.map((p) => [
        p.sku,
        p.barcode,
        p.fullName,
        p.brandName,
        p.categoryPath,
        p.vehicleMakes.join(' / '),
        p.vehicleModels.join(' / '),
        p.stockByLocation.map((at) => at.locationName).join(' / '),
        p.stock,
        p.costPrice,
        p.costCurrency,
        effectivePrice(p),
        p.status,
      ]),
    )
    toast.success(`Exported ${rows.length} products`)
  }

  const displaySwitch = (
    <div className="border-border rounded-control flex items-center border p-0.5">
      <Button
        type="button"
        variant={display === 'cards' ? 'secondary' : 'ghost'}
        size="icon"
        aria-label="Show products as boxes"
        aria-pressed={display === 'cards'}
        onClick={() => chooseDisplay('cards')}
      >
        <LayoutGrid />
      </Button>
      <Button
        type="button"
        variant={display === 'table' ? 'secondary' : 'ghost'}
        size="icon"
        aria-label="Show products as a list"
        aria-pressed={display === 'table'}
        onClick={() => chooseDisplay('table')}
      >
        <List />
      </Button>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Products"
        description={
          location
            ? `Stock, prices and totals at ${location.name}.`
            : 'Everything you sell, across every location.'
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              <Download />
              Export
            </Button>
            {can('products.list.create') ? (
              /*
                A split button, not a menu button: typing one product in is the
                common case and stays a single click, while the caret admits
                that a spreadsheet is the other way in. Both routes are named
                in the menu so neither is folded away.
              */
              <div className="flex items-center">
                <Button variant="primary" className="rounded-r-none" asChild>
                  <Link to={paths.products.new}>
                    <Plus />
                    Add product
                  </Link>
                </Button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button
                      variant="primary"
                      size="icon"
                      aria-label="Other ways to add products"
                      className="border-primary-fg/20 rounded-l-none border-l"
                    >
                      <ChevronDown />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="rounded-control border-border bg-surface shadow-popover z-50 min-w-56 border p-1"
                    >
                      <DropdownMenu.Item asChild>
                        <Link
                          to={paths.products.new}
                          className="rounded-control text-fg data-[highlighted]:bg-surface-muted flex cursor-pointer items-start gap-2 px-2 py-1.5 text-sm outline-none"
                        >
                          <PencilLine className="text-fg-muted mt-0.5 size-4 shrink-0" />
                          <span>
                            Enter manually
                            <span className="text-fg-subtle text-2xs block">
                              One product and its variations
                            </span>
                          </span>
                        </Link>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => setImporting(true)}
                        className="rounded-control text-fg data-[highlighted]:bg-surface-muted flex cursor-pointer items-start gap-2 px-2 py-1.5 text-sm outline-none"
                      >
                        <FileUp className="text-fg-muted mt-0.5 size-4 shrink-0" />
                        <span>
                          Import from a file
                          <span className="text-fg-subtle text-2xs block">
                            CSV or Excel, one row per variation
                          </span>
                        </span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              aria-label="How to list products"
              value={view}
              onChange={(next) =>
                setQuery({ view: next === 'variations' ? null : next, page: null, sort: null })
              }
              options={PRODUCT_LIST_VIEWS}
            />
            <StatusChips
              options={[
                { value: null, label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next })}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="At"
              allLabel="All locations"
              value={locationId}
              options={locationData.items.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
            <StatusChips
              ariaLabel="Filter by stock"
              options={[
                { value: null, label: 'Any stock' },
                { value: 'zero', label: 'Out of stock' },
                { value: 'low', label: 'Low stock' },
              ]}
              value={(query.stock as string | null) ?? null}
              onChange={(next) => setQuery({ stock: next })}
            />
          </div>
        }
      />

      {display === 'cards' ? (
        <div className="rounded-card border-border bg-surface shadow-card overflow-hidden border">
          <div className="border-border flex flex-wrap items-center gap-2 border-b p-2">
            <FilterSearch
              fields={filterFields}
              values={fieldFilters}
              onApply={(next) => setQuery({ f: encodeFilters(next) })}
              search={String(query.search ?? '')}
              onSearchChange={(search) => setQuery({ search })}
              placeholder="Filter and search"
            />
            <div className="flex-1" />
            {displaySwitch}
          </div>
          {(data?.items.length ?? 0) === 0 ? (
            isFiltered ? (
              <EmptyState
                title="No products match these filters"
                description="Try a different search term, or clear the filters to see everything."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => setQuery({ search: null, status: null, stock: null, f: null })}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No products yet"
                description="Products are everything you sell. Add the first one to start tracking stock and sales."
                action={
                  can('products.list.create') ? (
                    <Button variant="primary">
                      <Plus />
                      Add product
                    </Button>
                  ) : null
                }
              />
            )
          ) : (
            <ProductCardGrid
              rows={data?.items ?? []}
              onOpen={(variation) => navigate(paths.products.detail(variation.productId))}
            />
          )}
          <TablePagination
            total={data?.total ?? 0}
            pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
            onChange={({ page, pageSize }) => setQuery({ page, pageSize })}
          />
        </div>
      ) : (
        <DataTable
          reorderableColumns
          key={view}
          // Bumped when the default order changed, so a stored order from the
          // old column set does not survive into the new one.
          storageKey={view === 'variations' ? 'products-v2' : `products-v2-${view}`}
          columns={columns}
          initialHidden={hidden}
          getRowId={productRowId}
          data={data?.items ?? []}
          total={data?.total ?? 0}
          isLoading={isLoading}
          toolbar={
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <FilterSearch
                fields={filterFields}
                values={fieldFilters}
                onApply={(next) => setQuery({ f: encodeFilters(next) })}
                search={String(query.search ?? '')}
                onSearchChange={(search) => setQuery({ search })}
                placeholder="Filter and search"
              />
              <div className="flex-1" />
              {displaySwitch}
            </div>
          }
          pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
          onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
          onRowClick={(variation) => navigate(paths.products.detail(variation.productId))}
          emptyState={
            isFiltered ? (
              <EmptyState
                title="No products match these filters"
                description="Try a different search term, or clear the filters to see everything."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => setQuery({ search: null, status: null, stock: null, f: null })}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No products yet"
                description="Products are everything you sell. Add the first one to start tracking stock and sales."
                action={
                  can('products.list.create') ? (
                    <Button variant="primary">
                      <Plus />
                      Add product
                    </Button>
                  ) : null
                }
              />
            )
          }
        />
      )}

      <ImportProductsModal
        open={importing}
        onOpenChange={setImporting}
        onQueued={(fileName) => {
          // Still a job, not a save: the toast promises a queued file rather
          // than a finished import, and stays put now that there is no upload
          // log to send anybody to.
          toast.success(`${fileName} queued — the catalogue updates once it is processed`)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete product?"
        body={
          <>
            <strong className="text-fg font-medium">{pendingDelete?.name}</strong> will be removed
            from the catalog. Sales history that references it is kept.
          </>
        }
        submitting={deleteVariation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
