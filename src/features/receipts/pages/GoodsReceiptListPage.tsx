import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Download, Plus } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable } from '@/shared/components/DataTable'
import { ColumnFilterSearch } from '@/shared/components/ColumnFilterSearch'
import { RECEIPT_FILTER_OVERRIDES } from '../model/receiptFilterFields'
import { EmptyState } from '@/shared/components/EmptyState'
import { StatusChips } from '@/shared/components/StatusChips'
import { FilterSelect } from '@/shared/components/FilterSelect'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { toast } from '@/shared/ui/toast'
import { useListQuery } from '@/shared/hooks/useListQuery'
import { useSession } from '@/app/providers/SessionProvider'
import { paths } from '@/shared/config/paths'
import { formatMoney } from '@/shared/lib/format'
import { downloadCsv } from '@/shared/lib/csv'
import { useDataStore } from '@/data/store'
import { USD_RATE } from '@/data/seed'
import {
  useCreateReceipt,
  useReceiptStatusCounts,
  useReceipts,
  useSetReceiptStatus,
  useSuppliers,
} from '../api/receipts'
import { NewReceiptDialog } from '../components/NewReceiptDialog'
import {
  buildReceiptColumns,
  RECEIPT_COLUMNS_HIDDEN_BY_DEFAULT,
} from '../components/receiptColumns'
import { landedTotal, landedUnitCost, type GoodsReceipt } from '../model/receipt'
import { t } from '@/shared/i18n'

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
  const allReceipts = useDataStore((s) => s.receipts)
  const locations = useDataStore((s) => s.locations)
  const variations = useDataStore((s) => s.variations)
  const { data: suppliers } = useSuppliers()

  const scope = {
    f: query.f,
    search: query.search,
    location: query.location,
    supplier: query.supplier,
  }
  const { data, isLoading } = useReceipts(query)
  const { data: counts } = useReceiptStatusCounts(scope)
  const canSeeCost = can('products.cost.view')
  const createReceipt = useCreateReceipt()
  const [creating, setCreating] = useState(false)

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
    toast.success(t('{number} downloaded', { number: receipt.number }))
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

  return (
    <>
      <PageHeader
        title={t('Goods receipt')}
        description={t(
          'Every delivery from a supplier: what arrived, what it cost once freight and duty are counted, and how much of it has sold since.',
        )}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label={t('Download this list')}
              title={t('Download this list')}
              onClick={() =>
                downloadCsv(
                  'goods-receipts.csv',
                  ['ID', 'Date', 'Quantity', 'Location', 'User', 'Status', 'Supplier', 'Note'],
                  (data?.items ?? []).map((r) => [
                    r.number,
                    r.createdAt,
                    r.lines.reduce((sum, l) => sum + (l.receivedQuantity ?? l.orderedQuantity), 0),
                    r.locationName,
                    r.createdBy,
                    r.status,
                    r.supplierName ?? '',
                    r.comment ?? '',
                  ]),
                )
              }
            >
              <Download />
            </Button>
            {can(t('products.goodsReceipt.create')) ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus />
                {t('Add')}
              </Button>
            ) : null}
          </div>
        }
        below={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChips
              options={[
                { value: null, label: t('All') },
                { value: 'draft', label: t('Unfinished') },
                { value: 'received', label: t('Completed') },
                { value: 'cancelled', label: t('Deleted') },
              ]}
              value={(query.status as string | null) ?? null}
              onChange={(next) => setQuery({ status: next, page: null })}
              counts={counts}
            />
            <FilterSelect
              aria-label={t('Filter by supplier')}
              label={t('From')}
              allLabel={t('Any supplier')}
              value={(query.supplier as string | null) ?? null}
              options={suppliers.items.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(next) => setQuery({ supplier: next, page: null })}
            />
            <FilterSelect
              aria-label={t('Filter by location')}
              label={t('Into')}
              allLabel={t('All locations')}
              value={(query.location as string | null) ?? null}
              options={locations.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(next) => setQuery({ location: next, page: null })}
            />
          </div>
        }
      />

      <DataTable
        reorderableColumns
        storageKey="goods-receipts"
        columns={columns}
        initialHidden={RECEIPT_COLUMNS_HIDDEN_BY_DEFAULT}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        toolbar={
          <ColumnFilterSearch
            columns={columns}
            rows={allReceipts}
            overrides={RECEIPT_FILTER_OVERRIDES}
            query={query}
            setQuery={setQuery}
          />
        }
        pagination={{ page: Number(query.page ?? 1), pageSize: Number(query.pageSize ?? 25) }}
        onPaginationChange={({ page, pageSize }) => setQuery({ page, pageSize })}
        onRowClick={(receipt) => navigate(paths.products.goodsReceiptDetail(receipt.id))}
        emptyState={
          query.search || query.f || query.status || query.location || query.supplier ? (
            <EmptyState title={t('No receipts match these filters')} />
          ) : (
            <EmptyState
              title={t('Nothing has arrived yet')}
              description={t(
                "When a supplier's delivery arrives, a receipt records what was in it and adds it to stock. It is the only way stock goes up.",
              )}
              action={
                can('products.goodsReceipt.create') ? (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    <Plus />
                    {t('Add')}
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <NewReceiptDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(draft) => {
          const receipt = createReceipt.mutate(
            {
              supplierId: draft.supplierId,
              locationId: draft.locationId,
              comment: draft.comment,
              zone: draft.zone,
              usdRate: draft.usdRate,
              stocktakeOnPost: draft.stocktakeOnPost,
              kind: draft.kind,
              boughtFrom: draft.boughtFrom.trim() || null,
              lines: [],
              additionalCosts: [],
              status: 'draft',
            },
            {
              onSuccess: (created) => {
                setCreating(false)
                navigate(paths.products.goodsReceiptDetail(created.id))
              },
            },
          )
          return receipt
        }}
      />

      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => !open && setPendingCancel(null)}
        title={t('Delete this receipt?')}
        confirmLabel={t('Delete it')}
        body={
          pendingCancel ? (
            <>
              <strong className="text-fg font-medium">{pendingCancel.number}</strong> from{' '}
              {pendingCancel.supplierName ?? t('its supplier')}
              {pendingCancel.status === 'received'
                ? t(' has been posted, so its {p0} of stock is taken back off {locationName}.', {
                    p0: formatMoney(landedTotal(pendingCancel, USD_RATE)),
                    locationName: pendingCancel.locationName,
                  })
                : t(' has not been posted, so no stock changes.')}
            </>
          ) : null
        }
        onConfirm={() =>
          cancelReceipt.mutate(
            { to: 'cancelled' },
            {
              onSuccess: () => {
                toast.success(t('{number} cancelled', { number: pendingCancel?.number }))
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
