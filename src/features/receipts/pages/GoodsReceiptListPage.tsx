import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, PackagePlus, FileEdit, Percent } from 'lucide-react'
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
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format'
import { downloadCsv } from '@/shared/lib/csv'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import {
  useReceiptStatusCounts,
  useReceiptSummary,
  useReceipts,
  useSetReceiptStatus,
  useSuppliers,
} from '../api/receipts'
import {
  buildReceiptColumns,
  RECEIPT_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/receiptColumns'
import { landedTotal, landedUnitCost, type GoodsReceipt } from '../model/receipt'

/**
 * Goods arriving from suppliers — the only way stock legitimately enters.
 *
 * The uplift tile is the reason this screen is worth more than a list of
 * deliveries: it says how much freight and duty add on top of every supplier
 * invoice, which is the gap between what a part was bought for and what it
 * actually cost.
 */
export default function GoodsReceiptListPage() {
  const navigate = useNavigate()
  const { can } = useSession()
  const { query, setQuery } = useListQuery()
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const { data: suppliers } = useSuppliers()

  const scope = { search: query.search, location: query.location, supplier: query.supplier }
  const { data, isLoading } = useReceipts(query)
  const { data: counts } = useReceiptStatusCounts(scope)
  const summary = useReceiptSummary(scope)
  const canSeeCost = can('products.cost.view')

  const [pendingCancel, setPendingCancel] = useState<GoodsReceipt | null>(null)
  const cancelReceipt = useSetReceiptStatus(pendingCancel?.id ?? '')

  const stockAt = useMemo(
    () => (variationId: string, locationId: string) =>
      variations
        .find((v) => v.id === variationId)
        ?.stockByLocation.find((row) => row.locationId === locationId)?.quantity ?? 0,
    [variations],
  )
  const salePriceOf = useMemo(
    () => (variationId: string) => variations.find((v) => v.id === variationId)?.salePrice ?? 0,
    [variations],
  )

  /** OX puts a per-row download here, and a delivery is exactly the kind of
   *  document someone forwards to an accountant. */
  const downloadReceipt = (receipt: GoodsReceipt) => {
    downloadCsv(
      `${receipt.number}.csv`,
      ['SKU', 'Product', 'Invoiced', 'Received', 'Supplier price', 'Currency', 'Landed cost'],
      receipt.lines.map((line) => [
        line.sku,
        line.name,
        line.orderedQuantity,
        line.receivedQuantity ?? '',
        line.unitCost,
        line.costCurrency,
        canSeeCost ? Math.round(landedUnitCost(line, receipt, USD_RATE)) : '',
      ]),
    )
    toast.success(`${receipt.number} exported`)
  }

  const columns = useMemo(
    () =>
      buildReceiptColumns({
        canCancelReceipts: can('products.goodsReceipt.delete'),
        canSeeCost,
        usdRate: USD_RATE,
        stockAt,
        salePriceOf,
        onCancel: setPendingCancel,
        onDownload: downloadReceipt,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, canSeeCost, stockAt, salePriceOf],
  )

  const tiles = [
    {
      icon: PackagePlus,
      label: 'Received',
      value: formatNumber(summary.receivedUnits),
      meta: canSeeCost ? `${formatMoney(summary.landedValue)} landed` : 'units',
    },
    {
      icon: FileEdit,
      label: 'Drafts',
      value: formatNumber(summary.drafts),
      meta: 'not posted yet',
    },
    {
      icon: Percent,
      label: 'Landed uplift',
      value: formatPercent(summary.uplift),
      meta: 'freight and duty add this much to every invoice',
    },
  ]

  return (
    <>
      <PageHeader
        title="Goods receipt"
        description="Every delivery from a supplier: what arrived, what it cost once freight and duty are counted, and how much of it has sold since."
        action={
          can('products.goodsReceipt.create') ? (
            <Button variant="primary" asChild>
              <Link to={paths.products.newGoodsReceipt}>
                <Plus />
                New receipt
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
                { value: 'received', label: 'Received' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label="Filter by supplier"
              label="From"
              allLabel="Any supplier"
              value={(query.supplier as string | null) ?? null}
              options={suppliers.items.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(next) => setQuery({ supplier: next, page: null })}
            />
            <FilterSelect
              aria-label="Filter by location"
              label="Into"
              allLabel="All locations"
              value={(query.location as string | null) ?? null}
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
        storageKey="goods-receipts"
        columns={columns}
        initialHidden={RECEIPT_COLUMNS_HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <SearchInput
            value={String(query.search ?? '')}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by number, invoice, supplier, SKU or product…"
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        sorting={query.sort ? [{ id: String(query.sort), desc: query.order === 'desc' }] : []}
        onSortingChange={(sorting) => {
          const [first] = sorting
          setQuery({ sort: first?.id ?? null, order: first?.desc ? 'desc' : 'asc' })
        }}
        onRowClick={(receipt) => navigate(paths.products.goodsReceiptDetail(receipt.id))}
        emptyState={
          query.search || query.status || query.location || query.supplier ? (
            <EmptyState title="No receipts match these filters" />
          ) : (
            <EmptyState
              title="Nothing has arrived yet"
              description="When a supplier's delivery arrives, a receipt records what was in it and adds it to stock. It is the only way stock goes up."
              action={
                can('products.goodsReceipt.create') ? (
                  <Button variant="primary" asChild>
                    <Link to={paths.products.newGoodsReceipt}>
                      <Plus />
                      New receipt
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
        title="Cancel this receipt?"
        confirmLabel="Cancel receipt"
        body={
          pendingCancel ? (
            <>
              <strong className="text-fg font-medium">{pendingCancel.number}</strong> from{' '}
              {pendingCancel.supplierName ?? 'its supplier'}
              {pendingCancel.status === 'received'
                ? ` has been posted, so its ${formatMoney(
                    landedTotal(pendingCancel, USD_RATE),
                  )} of stock is taken back off ${pendingCancel.locationName}.`
                : ' has not been posted, so no stock changes.'}
            </>
          ) : null
        }
        onConfirm={() =>
          cancelReceipt.mutate(
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
