import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Truck, FileEdit, PackageCheck } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { SearchInput } from '@/shared/components/SearchInput'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import {
  useSetTransferStatus,
  useTransferStatusCounts,
  useTransferSummary,
  useTransfers,
} from '../api/transfers'
import {
  buildTransferColumns,
  TRANSFER_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/transferColumns'
import { transferQuantity, type Transfer } from '../model/transfer'

/**
 * Stock moving between locations. The list is a log of documents, so the
 * default order is newest first and the tiles answer the only urgent
 * question — what is on a truck right now, and therefore countable at neither
 * end.
 */
export default function TransfersListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const locations = useDataStore((s) => s.locations)

  const scope = { search: query.search, location: query.location }
  const { data, isLoading } = useTransfers(query)
  const { data: counts } = useTransferStatusCounts(scope)
  const summary = useTransferSummary(scope)

  const [pendingCancel, setPendingCancel] = useState<Transfer | null>(null)
  const cancelTransfer = useSetTransferStatus(pendingCancel?.id ?? '')

  const locationId = (query.location as string | null) ?? null

  const columns = useMemo(
    () =>
      buildTransferColumns({
        canCancelTransfers: can('products.transfers.delete'),
        onCancel: setPendingCancel,
      }),
    [can],
  )

  const tiles = [
    {
      icon: Truck,
      label: 'In transit',
      value: formatNumber(summary.inTransit),
      meta: `${formatNumber(summary.inTransitUnits)} units on the move`,
    },
    {
      icon: FileEdit,
      label: 'Drafts',
      value: formatNumber(summary.drafts),
      meta: 'not sent yet',
    },
    {
      icon: PackageCheck,
      label: 'Received',
      value: formatNumber(summary.receivedRecently),
      meta: 'in the last 30 days',
    },
  ]

  return (
    <>
      <PageHeader
        title="Transfers"
        description="Move stock between warehouses and shops. Goods in transit belong to neither."
        action={
          can('products.transfers.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newTransfer}>
                <Plus />
                New transfer
              </Link>
            </Button>
          ) : null
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: 'All' },
                { value: 'draft', label: 'Draft' },
                { value: 'in_transit', label: 'In transit' },
                { value: 'received', label: 'Received' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="Involving"
              allLabel="Any location"
              value={locationId}
              options={locations.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className="flex items-start gap-3 p-4">
            <span className="bg-surface-inset text-fg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <tile.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg-muted text-sm">{tile.label}</p>
              <p className="text-fg mt-0.5 text-lg font-semibold">{tile.value}</p>
              <p className="text-fg-subtle text-2xs">{tile.meta}</p>
            </div>
          </Card>
        ))}
      </div>

      <DataTable
        storageKey="transfers"
        columns={columns}
        initialHidden={TRANSFER_COLUMNS_HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, location, SKU or product…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const [first] = sorting
          setQuery({ sort: first?.id ?? null, order: first?.desc ? 'desc' : 'asc' })
        }}
        onRowClick={(transfer) => navigate(paths.products.transferDetail(transfer.id))}
        emptyState={
          query.search || query.status || query.location ? (
            <EmptyState title="No transfers match these filters" />
          ) : (
            <EmptyState
              title="Nothing has moved yet"
              description="A transfer takes stock off one shelf and puts it on another, leaving a document behind."
              action={
                can('products.transfers.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newTransfer}>
                      <Plus />
                      New transfer
                    </Link>
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => !open && setPendingCancel(null)}
        title="Cancel this transfer?"
        confirmLabel="Cancel transfer"
        body={
          pendingCancel ? (
            <>
              <strong className="text-fg font-medium">{pendingCancel.number}</strong> moves{' '}
              {formatNumber(transferQuantity(pendingCancel))} units from{' '}
              {pendingCancel.fromLocationName} to {pendingCancel.toLocationName}.
              {pendingCancel.status === 'in_transit'
                ? ' It has already been sent, so the stock goes back to where it came from.'
                : ' Nothing has moved yet, so no stock changes.'}
            </>
          ) : null
        }
        onConfirm={() =>
          cancelTransfer.mutate('cancelled', {
            onSuccess: () => {
              toast.success(`${pendingCancel?.number} cancelled`)
              setPendingCancel(null)
            },
            onError: (message) => toast.error(message),
          })
        }
      />
    </>
  )
}
