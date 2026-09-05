import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import type { TableColumn } from '@/shared/components/table/features'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatDate, formatMoney } from '@/shared/lib/format'
import { useSales } from '../api/sales'
import { PAYMENT_METHODS, type Sale, type SaleStatus } from '../model/sale'

const statusTone: Record<
  SaleStatus,
  { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }
> = {
  completed: { tone: 'success', label: 'Completed' },
  draft: { tone: 'warning', label: 'Open' },
  postponed: { tone: 'warning', label: 'Postponed' },
  deleted: { tone: 'danger', label: 'Deleted' },
}

const columns: TableColumn<Sale>[] = [
  {
    accessorKey: 'number',
    header: 'Number',
    cell: ({ row }) => <span className="text-2xs font-mono">{row.original.number}</span>,
    enableHiding: false,
  },
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: 'clientName',
    header: 'Client',
    cell: ({ row }) => row.original.clientName ?? <span className="text-fg-subtle">Walk-in</span>,
  },
  { accessorKey: 'locationName', header: 'Location' },
  { accessorKey: 'sellerName', header: 'Seller' },
  {
    accessorKey: 'paymentMethod',
    header: 'Payment',
    cell: ({ row }) =>
      PAYMENT_METHODS.find((m) => m.value === row.original.paymentMethod)?.label ?? '—',
  },
  {
    accessorKey: 'total',
    header: 'Total',
    meta: { align: 'right' },
    cell: ({ row }) => formatMoney(row.original.total),
  },
  {
    accessorKey: 'debt',
    header: 'Debt',
    meta: { align: 'right' },
    cell: ({ row }) =>
      row.original.debt > 0 ? (
        <span className="text-danger font-medium">{formatMoney(row.original.debt)}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const { tone, label } = statusTone[row.original.status]
      return <Badge tone={tone}>{label}</Badge>
    },
  },
]

/**
 * One component behind every sales list — All, Open, Postponed, Deleted. They
 * are the same table over a different status filter, so they must not drift
 * into four hand-built screens.
 */
export function SalesListPage({
  title,
  description,
  status,
  canCreate = true,
}: {
  title: string
  description: string
  status?: SaleStatus
  canCreate?: boolean
}) {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const { data, isLoading } = useSales({ ...query, status })

  const showCreate = canCreate && can('sales.orders.create')
  const isFiltered = Boolean(query.search)

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          showCreate ? (
            <Button variant="primary" asChild>
              <Link to={paths.sales.newSale}>
                <Plus />
                New sale
              </Link>
            </Button>
          ) : null
        }
      />

      <DataTable
        storageKey={`sales-${status ?? 'all'}`}
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, client or location…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const next = sorting[0]
          setQuery({ sort: next?.id ?? null, order: next ? (next.desc ? 'desc' : 'asc') : null })
        }}
        onRowClick={(sale) => navigate(paths.sales.orderDetail(sale.id))}
        emptyState={
          isFiltered ? (
            <EmptyState
              title="No sales match these filters"
              description="Try a different search term, or clear the filters to see everything."
              action={
                <Button variant="secondary" onClick={() => setQuery({ search: null })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No sales yet"
              description="Record the first sale taken at the desk, by phone or on delivery."
              action={
                showCreate ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.sales.newSale}>
                      <Plus />
                      New sale
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />
    </>
  )
}

export default function AllSalesPage() {
  return <SalesListPage title="All sales" description="Every sale, across every location." />
}
