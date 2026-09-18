import { useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { SpreadsheetImport } from '@/shared/components/SpreadsheetImport'
import { toast } from '@/shared/ui/toast'
import { paths } from '@/shared/config/paths'
import { useOrder, useUpdateOrder } from '../api/orders'
import { t } from '@/shared/i18n'

/** A supplier's spreadsheet, onto an order that has not been sent. */
export default function OrderImportPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const { data: order } = useOrder(orderId)
  const update = useUpdateOrder(orderId)

  if (!order) return <EmptyState title={t('That order no longer exists')} />

  const back = paths.procurement.orderDetail(order.id)

  return (
    <SpreadsheetImport
      title={`Upload a spreadsheet — ${order.number}`}
      backTo={back}
      backLabel="Back to the order"
      quantityLabel="Ordering"
      onImport={(imported) => {
        // Tops up what is already on the order rather than replacing it.
        const byVariation = new Map(order.lines.map((line) => [line.variationId, line]))
        for (const row of imported) {
          const existing = byVariation.get(row.variation.id)
          byVariation.set(row.variation.id, {
            id: existing?.id ?? `pol-${order.id}-${row.variation.id}`,
            variationId: row.variation.id,
            productId: row.variation.productId,
            sku: row.variation.sku,
            name: row.variation.fullName,
            imageUrl: row.variation.imageUrl,
            unit: row.variation.unit,
            orderedQuantity: row.quantity,
            receivedQuantity: existing?.receivedQuantity ?? 0,
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
