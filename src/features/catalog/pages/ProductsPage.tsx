import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchInput } from '@/shared/components/SearchInput'
import { DataTable } from '@/shared/components/DataTable'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { paths } from '@/shared/config/paths'
import { useSession } from '@/app/providers/SessionProvider'
import { useDeleteProduct, useProducts } from '../api/products'
import { buildProductColumns } from '../components/productColumns'
import type { Product } from '../model/product'

/**
 * Reference implementation of the list-page pattern: PageHeader (title + one
 * primary action) → ListPage (search/filters) → DataTable. It also shows the
 * two state rules that are easiest to get wrong: a filtered-empty result offers
 * "clear filters" rather than the create action, and the delete confirmation
 * stays open with the spinner on its own button until the server confirms.
 * Copy this shape for every other list screen.
 */
export default function ProductsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data, isLoading } = useProducts(query)
  const deleteProduct = useDeleteProduct()

  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)

  const columns = useMemo(
    () =>
      buildProductColumns({
        canEdit: can('catalog.products.edit'),
        canDelete: can('catalog.products.delete'),
        onEdit: (product) => navigate(paths.catalog.productDetail(product.id)),
        onDelete: setPendingDelete,
      }),
    [can, navigate],
  )

  const isFiltered = Boolean(query.search)

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteProduct.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`${pendingDelete.name} deleted`)
        setPendingDelete(null)
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell, across every location."
        action={
          can('catalog.products.create') ? (
            <Button variant="primary">
              <Plus />
              Add product
            </Button>
          ) : null
        }
      />

      <DataTable
        storageKey="products"
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by name, SKU or barcode…"
          />
        }
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const next = sorting[0]
          setQuery({ sort: next?.id ?? null, order: next ? (next.desc ? 'desc' : 'asc') : null })
        }}
        onRowClick={(product) => navigate(paths.catalog.productDetail(product.id))}
        emptyState={
          isFiltered ? (
            <EmptyState
              title="No products match these filters"
              description="Try a different search term, or clear the filters to see everything."
              action={
                <Button variant="secondary" onClick={() => setQuery({ search: null })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No products yet"
              description="Products are everything you sell. Add the first one to start tracking stock and sales."
              action={
                can('catalog.products.create') ? (
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
        submitting={deleteProduct.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
