import { useEffect, useMemo, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { QuantityStepper } from '@/shared/components/catalogue/VariationsDialog'
import { formatMoneyIn, formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import type { CatalogueEntry } from '@/features/suppliers/model/catalogue'
import { suggestOrder, type OrderSuggestion } from '../model/suggestOrder'

/**
 * What to order, worked out from what sold.
 *
 * The reason this exists, in the client's words: with ten thousand products
 * nobody can check stock and sales one by one and decide. So it does the pass
 * and proposes the list — but as a proposal, not an action. Everything is
 * ticked to begin with, because the point is to save the picking rather than
 * to make somebody agree line by line, and every row shows the figures behind
 * it so an odd suggestion can be dropped before it reaches the supplier.
 */
export function GenerateOrderModal({
  open,
  onOpenChange,
  entries,
  supplierName,
  scope,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: CatalogueEntry[]
  /** Who the order is with, for the title — a supplier's name, or "the market". */
  supplierName: string
  /** How the empty state names what was searched, e.g. "Everything in our catalogue". */
  scope?: string
  onAdd: (suggestions: OrderSuggestion[]) => void
}) {
  const sales = useDataStore((s) => s.sales)
  const variations = useDataStore((s) => s.variations)
  const [months, setMonths] = useState<'3' | '6'>('3')
  const [dropped, setDropped] = useState<string[]>([])
  /** Quantities somebody changed from what was suggested, by catalogue line. */
  const [edited, setEdited] = useState<Record<string, number>>({})

  const suggestions = useMemo(
    () => suggestOrder({ entries, sales, months: Number(months) }),
    [entries, sales, months],
  )

  // A different window is a different proposal, so previous exclusions no
  // longer refer to anything.
  useEffect(() => {
    setDropped([])
    setEdited({})
  }, [months, open])

  /** Our photo and SKU for each line, as the transfer's suggestions show them. */
  const ours = useMemo(() => new Map(variations.map((v) => [v.id, v])), [variations])

  const quantityOf = (s: OrderSuggestion) => edited[s.supplierProductId] ?? s.suggested
  const chosen = suggestions
    .filter((s) => !dropped.includes(s.supplierProductId) && quantityOf(s) > 0)
    .map((s) => ({ ...s, suggested: quantityOf(s) }))
  const units = chosen.reduce((sum, s) => sum + s.suggested, 0)

  const toggle = (id: string) =>
    setDropped((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`What to order from ${supplierName}`}
      description={`Worked out from what sold over the window and what is on the shelf now, across every location.`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-fg-subtle text-2xs">
            {chosen.length === 0
              ? 'Nothing selected'
              : `${formatNumber(chosen.length)} products · ${formatNumber(units)} units`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={chosen.length === 0}
              onClick={() => {
                onAdd(chosen)
                onOpenChange(false)
              }}
            >
              Add {formatNumber(chosen.length)} to the order
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-fg-muted text-sm">Based on sales over</span>
          <SegmentedControl
            aria-label="How far back to look"
            value={months}
            onChange={setMonths}
            options={[
              { value: '3', label: 'Last 3 months' },
              { value: '6', label: 'Last 6 months' },
            ]}
          />
        </div>

        {suggestions.length === 0 ? (
          <div className="text-fg-muted rounded-card border-border border border-dashed p-6 text-center text-sm">
            <Wand2 className="text-fg-subtle mx-auto mb-2 size-5" />
            <p className="text-fg font-medium">Nothing needs ordering</p>
            <p className="text-2xs mt-1">
              {scope ?? `Everything ${supplierName} carries`} is either stocked deep enough for
              another {months} months, or has not sold in that time.
            </p>
          </div>
        ) : (
          <div className="border-border rounded-card max-h-96 overflow-y-auto border">
            <table className="w-full text-sm">
              <thead className="bg-canvas sticky top-0">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Sold</th>
                  <th className="px-3 py-2 text-right font-semibold">In stock</th>
                  <th className="w-40 px-3 py-2 text-right font-semibold">Order</th>
                  <th className="px-3 py-2 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => {
                  const on = !dropped.includes(suggestion.supplierProductId)
                  return (
                    <tr key={suggestion.supplierProductId} className="border-border border-t">
                      <td className="px-3 py-2">
                        <Checkbox
                          aria-label={`Include ${suggestion.name}`}
                          checked={on}
                          onCheckedChange={() => toggle(suggestion.supplierProductId)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb
                            src={ours.get(suggestion.variationId)?.imageUrl ?? null}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="text-fg truncate font-medium">{suggestion.name}</p>
                            <p className="text-fg-subtle text-2xs font-mono">
                              {ours.get(suggestion.variationId)?.sku ?? suggestion.supplierSku}
                              {/* A market run is picked from our list, so their code is ours. */}
                              {suggestion.supplierSku &&
                              suggestion.supplierSku !== ours.get(suggestion.variationId)?.sku
                                ? ` · ${suggestion.supplierSku}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                        {formatNumber(suggestion.sold)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={suggestion.stock === 0 ? 'text-danger' : ''}>
                          {formatNumber(suggestion.stock)}
                        </span>
                      </td>
                      <td className="text-fg w-44 px-3 py-2 text-right font-medium tabular-nums">
                        <div className="flex items-center justify-end gap-1.5">
                          <QuantityStepper
                            value={quantityOf(suggestion)}
                            label={suggestion.name}
                            onChange={(next) =>
                              setEdited((current) => ({
                                ...current,
                                [suggestion.supplierProductId]: Math.max(0, next),
                              }))
                            }
                          />
                          <span className="text-fg-subtle text-2xs">{suggestion.unit}</span>
                        </div>
                        {quantityOf(suggestion) === suggestion.suggested &&
                        suggestion.suggested > suggestion.shortfall ? (
                          // Says why it is more than the gap, rather than
                          // quietly ordering more than was asked for.
                          <p className="text-fg-subtle text-2xs font-normal whitespace-nowrap">
                            {formatNumber(suggestion.shortfall)} short,{' '}
                            {formatNumber(suggestion.suggested)} minimum
                          </p>
                        ) : null}
                      </td>
                      <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                        {formatMoneyIn(
                          quantityOf(suggestion) * suggestion.price,
                          suggestion.currency,
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
