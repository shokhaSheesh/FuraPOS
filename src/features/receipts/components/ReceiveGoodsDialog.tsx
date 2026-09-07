import { useEffect, useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'
import type { GoodsReceipt } from '../model/receipt'

/**
 * Count what came off the truck.
 *
 * Pre-filled with the invoice, because the invoice is usually right and the
 * ordinary case should be one click. A shortfall here is a **claim against the
 * supplier** rather than a loss — the goods were never ours to lose — so the
 * copy says so, and nothing is written off.
 */
export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  receipt,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  receipt: GoodsReceipt
  onConfirm: (quantities: Record<string, number>) => void
}) {
  const [values, setValues] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!open) return
    setValues(Object.fromEntries(receipt.lines.map((line) => [line.id, line.orderedQuantity])))
  }, [open, receipt.id, receipt.lines])

  const invoiced = receipt.lines.reduce((sum, line) => sum + line.orderedQuantity, 0)
  const counted = receipt.lines.reduce((sum, line) => sum + (values[line.id] ?? 0), 0)
  const gap = invoiced - counted

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Post this receipt"
      description="Count what actually arrived. Stock lands and cost prices update the moment you confirm."
      size="lg"
      primary={{
        label: 'Post receipt',
        disabled: counted === 0,
        onClick: () => onConfirm(values),
      }}
    >
      <div className="space-y-3">
        <div className="border-border rounded-card overflow-x-auto border">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-right font-semibold">Invoiced</th>
                <th className="px-3 py-2 text-right font-semibold">Arrived</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line) => {
                const value = values[line.id] ?? 0
                const short = value < line.orderedQuantity
                return (
                  <tr key={line.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <ProductThumb src={line.imageUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="text-fg font-medium">{line.name}</p>
                          <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                      {formatNumber(line.orderedQuantity)} {line.unit}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {short ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-2xs"
                            onClick={() =>
                              setValues((v) => ({ ...v, [line.id]: line.orderedQuantity }))
                            }
                          >
                            All
                          </Button>
                        ) : null}
                        <NumberField
                          className="w-24"
                          nullable={false}
                          min={0}
                          aria-label={`Arrived ${line.name}`}
                          value={value}
                          onChange={(next) => setValues((v) => ({ ...v, [line.id]: next ?? 0 }))}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {gap > 0 ? (
          <p className="text-warning text-sm">
            {formatNumber(gap)} {gap === 1 ? 'unit is' : 'units are'} short of the invoice — a claim
            against {receipt.supplierName ?? 'the supplier'}, not stock that went missing.
          </p>
        ) : gap < 0 ? (
          <p className="text-fg-muted text-sm">
            {formatNumber(-gap)} more than invoiced. Worth checking the paperwork before posting.
          </p>
        ) : (
          <p className="text-fg-subtle text-sm">
            {formatNumber(counted)} units, matching the invoice.
          </p>
        )}
      </div>
    </Modal>
  )
}
