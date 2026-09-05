import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { ListPage } from '@/shared/components/ListPage'
import { DataTable } from '@/shared/components/DataTable'
import { Button } from '@/shared/ui/Button'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { paths } from '@/shared/config/paths'
import { useSession } from '@/app/providers/SessionProvider'
import { useProducts } from '../api/products'
import { buildProductColumns } from '../components/productColumns'

/**
 * Reference implementation of the list-page pattern: PageHeader (title + one
 * primary action) → ListPage (search/filters) → DataTable (columns, sorting,
 * pagination). Copy this shape for every other list screen.
 */
export default function ProductsPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data, isLoading } = useProducts(query)

  const columns = useMemo(
    () =>
      buildProductColumns({
        canEdit: can('catalog.products.edit'),
        canDelete: can('catalog.products.delete'),
        onEdit: (product) => navigate(paths.catalog.productDetail(product.id)),
        // TODO: open the delete confirmation modal once the modal primitive lands.
        onDelete: () => {},
      }),
    [can, navigate],
  )

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

      <ListPage
        search={{
          value: String(query.search ?? ''),
          onChange: (search) => setQuery({ search }),
          placeholder: 'Search by name, SKU or barcode…',
        }}
      >
        <DataTable
          storageKey="products"
          columns={columns}
          data={data?.items ?? []}
          total={data?.total ?? 0}
          isLoading={isLoading}
          pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
          onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
          sorting={
            query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []
          }
          onSortingChange={(sorting) => {
            const next = sorting[0]
            setQuery({ sort: next?.id ?? null, order: next ? (next.desc ? 'desc' : 'asc') : null })
          }}
          onRowClick={(product) => navigate(paths.catalog.productDetail(product.id))}
        />
      </ListPage>
    </>
  )
}
