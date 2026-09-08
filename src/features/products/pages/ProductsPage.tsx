import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronDown, Download, FileUp, PencilLine, Plus } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { downloadCsv } from '@/shared/lib/csv'
import { USD_RATE } from '@/data/seed'
import { useCatalogSummary, useDeleteVariation, useLocations, useVariations } from '../api/products'
import {
  buildProductColumns,
  PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/productColumns'
import { ProductsSummaryStrip } from '../components/ProductsSummaryStrip'
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
  const { data, isLoading } = useVariations(query)
  /*
    The tiles count the three states, so they must be blind to the state
    filter — otherwise picking "Active" would make Active and All read the same
    number and Archived read zero. Every other filter still applies, the
    location scope included.
  */
  const scope = { search: query.search, stock: query.stock, location: query.location }
  const { data: summary, isLoading: summaryLoading } = useCatalogSummary(scope)
  const { data: locationData } = useLocations()
  const locationId = (query.location as string | null) ?? null
  const location = locationData.items.find((item) => item.id === locationId)
  const deleteVariation = useDeleteVariation()

  const [pendingDelete, setPendingDelete] = useState<VariationRow | null>(null)
  const [importing, setImporting] = useState(false)

  const columns = useMemo(
    () =>
      buildProductColumns({
        // Suppliers invoice in USD, so margin must convert before comparing.
        usdRate: USD_RATE,
        canSeeCost: can('products.cost.view'),
        canEdit: can('products.list.edit'),
        canDelete: can('products.list.delete'),
        onEdit: (variation) => navigate(paths.products.detail(variation.productId)),
        onDelete: setPendingDelete,
      }),
    [can, navigate],
  )

  const isFiltered = Boolean(query.search || query.status || query.stock || query.location)

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
        p.vehicleMake,
        p.vehicleModels.join(' / '),
        p.stock,
        p.costPrice,
        p.costCurrency,
        effectivePrice(p),
        p.status,
      ]),
    )
    toast.success(`Exported ${rows.length} products`)
  }

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

      <ProductsSummaryStrip summary={summary} loading={summaryLoading} />

      <DataTable
        storageKey="products"
        columns={columns}
        initialHidden={PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by name, SKU, barcode or OEM…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const next = sorting[0]
          setQuery({ sort: next?.id ?? null, order: next ? (next.desc ? 'desc' : 'asc') : null })
        }}
        onRowClick={(variation) => navigate(paths.products.detail(variation.productId))}
        emptyState={
          isFiltered ? (
            <EmptyState
              title="No products match these filters"
              description="Try a different search term, or clear the filters to see everything."
              action={
                <Button
                  variant="secondary"
                  onClick={() => setQuery({ search: null, status: null, stock: null })}
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
