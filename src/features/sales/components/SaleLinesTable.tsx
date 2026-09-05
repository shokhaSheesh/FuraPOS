import { Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { EmptyState } from '@/shared/components/EmptyState'
import { formatMoney } from '@/shared/lib/format'
import { lineTotal, type SaleLine } from '../model/sale'

interface Props {
  lines: SaleLine[]
  onChange: (id: string, patch: Partial<SaleLine>) => void
  onRemove: (id: string) => void
}

/**
 * Editable line items. Quantity, price and discount are all editable in place —
 * a manual sale is exactly the case where the price on the shelf and the price
 * agreed are not always the same.
 */
export function SaleLinesTable({ lines, onChange, onRemove }: Props) {
  if (lines.length === 0) {
    return (
      <EmptyState
        title="No products yet"
        description="Search above to add the first line. Quantity and price stay editable afterwards."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted">
          <tr className="text-fg-muted text-2xs tracking-wide uppercase">
            <th scope="col" className="h-9 px-3 text-left font-semibold">
              Product
            </th>
            <th scope="col" className="h-9 w-28 px-3 text-right font-semibold">
              Qty
            </th>
            <th scope="col" className="h-9 w-40 px-3 text-right font-semibold">
              Price
            </th>
            <th scope="col" className="h-9 w-24 px-3 text-right font-semibold">
              Disc %
            </th>
            <th scope="col" className="h-9 w-36 px-3 text-right font-semibold">
              Total
            </th>
            <th scope="col" className="h-9 w-12 px-3" />
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2">
                <p className="text-fg font-medium">{line.name}</p>
                <p className="text-fg-subtle text-2xs font-mono">{line.sku}</p>
              </td>
              <td className="px-3 py-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={`Quantity for ${line.name}`}
                  value={line.quantity}
                  onChange={(e) => onChange(line.id, { quantity: Number(e.target.value) })}
                  className="h-8 text-right"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  type="number"
                  min={0}
                  aria-label={`Price for ${line.name}`}
                  value={line.unitPrice}
                  onChange={(e) => onChange(line.id, { unitPrice: Number(e.target.value) })}
                  className="h-8 text-right"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  aria-label={`Discount for ${line.name}`}
                  value={line.discountPercent}
                  onChange={(e) =>
                    onChange(line.id, {
                      discountPercent: Math.min(100, Math.max(0, Number(e.target.value))),
                    })
                  }
                  className="h-8 text-right"
                />
              </td>
              <td className="text-fg px-3 py-2 text-right font-medium tabular-nums">
                {formatMoney(lineTotal(line))}
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${line.name}`}
                  className="hover:text-danger"
                  onClick={() => onRemove(line.id)}
                >
                  <Trash2 />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
