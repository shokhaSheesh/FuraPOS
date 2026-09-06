import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Download, Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { downloadCsv } from '@/shared/lib/csv'
import { USD_RATE } from '@/data/seed'
import {
  useCatalogStatusCounts,
  useCatalogSummary,
  useDeleteVariation,
  useProducts,
  useVariations,
} from '../api/products'
import {
  buildProductColumns,
  PRODUCT_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/productColumns'
import { ProductsSummaryStrip } from '../components/ProductsSummaryStrip'
import { productParentColumns } from '../components/productParentColumns'
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

  /**
   * Two ways to read the same catalogue, as in the reference product: by
   * variation (the sellable rows) or by product (the parent). Variations is
   * the default because that is what has a price, a barcode and stock.
   */
  const byProduct = query.view === 'products'
  // `enabled` is a React Query option, not a request param — passing it in the
  // query object would send ?enabled=false to the server and still fetch.
  const { data, isLoading } = useVariations(query, { enabled: !byProduct })
  const { data: parents, isLoading: parentsLoading } = useProducts(query, { enabled: byProduct })
  const scope = { search: query.search, status: query.status, stock: query.stock }
  const { data: summary, isLoading: summaryLoading } = useCatalogSummary(scope)
  const { data: counts } = useCatalogStatusCounts({ search: query.search, stock: query.stock })
  const deleteVariation = useDeleteVariation()

  const [pendingDelete, setPendingDelete] = useState<VariationRow | null>(null)

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

  const isFiltered = Boolean(query.search || query.status || query.stock)

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteVariation.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`${pendingDelete.name} deleted`)
        setPendingDelete(null)
      }
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
        description="Everything you sell, across every location."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              <Download />
              Export
            </Button>
            {can('products.list.create') ? (
              <Button variant="primary">
                <Plus />
                Add product
              </Button>
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
              counts={counts}
            />
            <StatusChips
              ariaLabel="View"
              options={[
                { value: null, label: 'By variation' },
                { value: 'products', label: 'By product' },
              ]}
              value={(query.view as string | null) ?? null}
              onChange={(next) => setQuery({ view: next, page: null })}
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

      {byProduct ? (
        <DataTable
          storageKey="products-parents"
          columns={productParentColumns}
          data={parents?.items ?? []}
          total={parents?.total ?? 0}
          isLoading={parentsLoading}
          toolbar={
            <SearchInput
              value={String(query.search ?? '')}
              onChange={(search) => setQuery({ search })}
              placeholder="Search by name, OEM, brand or vehicle…"
            />
          }
          pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
          onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
          onRowClick={(product) => navigate(paths.products.detail(product.id))}
          emptyState={<EmptyState title="No products match these filters" />}
        />
      ) : (
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
      )}

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
