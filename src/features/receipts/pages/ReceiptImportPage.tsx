import { useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { SpreadsheetImport } from '@/shared/components/SpreadsheetImport'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useReceipt, useUpdateReceipt } from '../api/receipts'
import { t } from '@/shared/i18n'

/** A supplier's spreadsheet, onto a receipt that is still being built. */
export default function ReceiptImportPage() {
  const { receiptId = '' } = useParams()
  const navigate = useNavigate()
  const { data: receipt } = useReceipt(receiptId)
  const update = useUpdateReceipt(receiptId)

  if (!receipt) return <EmptyState title={t('That receipt no longer exists')} />

  const back = paths.products.goodsReceiptDetail(receipt.id)

  return (
    <SpreadsheetImport
      title={`Upload a spreadsheet — ${receipt.number}`}
      backTo={back}
      backLabel="Back to the receipt"
      quantityLabel="Actual quantity"
      onImport={(imported) => {
        /*
          Tops up what is already on the receipt rather than replacing it: half
          a delivery is often typed in before somebody remembers the supplier
          sent a file for the rest.
        */
        const byVariation = new Map(receipt.lines.map((line) => [line.variationId, line]))
        for (const row of imported) {
          const existing = byVariation.get(row.variation.id)
          byVariation.set(row.variation.id, {
            id: existing?.id ?? `grl-${receipt.id}-${row.variation.id}`,
            variationId: row.variation.id,
            productId: row.variation.productId,
            sku: row.variation.sku,
            name: row.variation.fullName,
            imageUrl: row.variation.imageUrl,
            unit: row.variation.unit,
            orderedQuantity: existing?.orderedQuantity ?? 0,
            receivedQuantity: row.quantity,
            unitCost: row.unitCost ?? existing?.unitCost ?? row.variation.costPrice,
            costCurrency: row.currency ?? existing?.costCurrency ?? row.variation.costCurrency,
          })
        }
        update.mutate(
          { lines: [...byVariation.values()] },
          {
            onSuccess: () => {
              toast.success(`${imported.length} products added from the spreadsheet`)
              navigate(back)
            },
            onError: (message) => toast.error(message),
          },
        )
      }}
    />
  )
}
