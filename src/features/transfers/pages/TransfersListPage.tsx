import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { TRANSFER_FILTER_OVERRIDES } from '../model/transferFilterFields'
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
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import { useSetTransferStatus, useTransferStatusCounts, useTransfers } from '../api/transfers'
import {
  buildTransferColumns,
  TRANSFER_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/transferColumns'
import { transferQuantity, type Transfer } from '../model/transfer'

/**
 * Stock moving between locations. The list is a log of documents, so the
 * default order is newest first; the "In transit" chip answers the only urgent
 * question — what is on a truck right now, and therefore countable at neither
 * end.
 */
export default function TransfersListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const allTransfers = useDataStore((s) => s.transfers)
  const locations = useDataStore((s) => s.locations)

  const scope = { search: query.search, location: query.location, f: query.f }
  const { data, isLoading } = useTransfers(query)
  const { data: counts } = useTransferStatusCounts(scope)

  const [pendingCancel, setPendingCancel] = useState<Transfer | null>(null)
  const cancelTransfer = useSetTransferStatus(pendingCancel?.id ?? '')

  const locationId = (query.location as string | null) ?? null

  const canSeeCost = can('products.cost.view')

  /** The transfer's lines as a spreadsheet — what was asked for, sent and counted in. */
  const downloadTransfer = (transfer: Transfer) => {
    downloadCsv(
      `${transfer.number}.csv`,
      [
        'SKU',
        'Product',
        'Unit',
        'Requested',
        'Sent',
        'Received',
        ...(canSeeCost ? ['Cost price', 'Currency'] : []),
        'Sale price',
      ],
      transfer.lines.map((line) => [
        line.sku,
        line.name,
        line.unit,
        line.requestedQuantity,
        line.sentQuantity ?? '',
        line.receivedQuantity ?? '',
        ...(canSeeCost ? [line.unitCost, line.costCurrency] : []),
        line.unitPrice,
      ]),
    )
    toast.success(`${transfer.number} downloaded`)
  }

  const columns = useMemo(
    () =>
      buildTransferColumns({
        canCancelTransfers: can('products.transfers.delete'),
        canSeeCost: can('products.cost.view'),
        usdRate: USD_RATE,
        onCancel: setPendingCancel,
        onDownload: downloadTransfer,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  )

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
                { value: 'draft', label: 'Unfinished' },
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

      <DataTable
        storageKey="transfers"
        columns={columns}
        initialHidden={TRANSFER_COLUMNS_HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={allTransfers}
            overrides={TRANSFER_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        // An unfinished transfer opens where it was left, ready to carry on.
        onRowClick={(transfer) =>
          navigate(
            transfer.status === 'draft'
              ? paths.products.editTransfer(transfer.id)
              : paths.products.transferDetail(transfer.id),
          )
        }
        emptyState={
          query.search || query.status || query.location || query.f ? (
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
          cancelTransfer.mutate(
            { to: 'cancelled' },
            {
              onSuccess: () => {
                toast.success(`${pendingCancel?.number} cancelled`)
                setPendingCancel(null)
              },
              onError: (message) => toast.error(message),
            },
          )
        }
      />
    </>
  )
}
