import { useEffect, useMemo, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { formatNumber } from '@/shared/lib/format'
import { useDataStore } from '@/data/store'
import { suggestTransfer, type TransferSuggestion } from '../model/suggest'

/**
 * What the shop needs, worked out from what it sold.
 *
 * Deliberately a proposal rather than an action: it fills the table, it does
 * not send anything. Everything is ticked to begin with — the point is to save
 * the picking, not to make somebody agree line by line — but each row shows
 * the four numbers behind it so an odd suggestion can be spotted and dropped
 * before it reaches the lorry.
 */
export function GenerateTransferModal({
  open,
  onOpenChange,
  fromLocationId,
  toLocationId,
  fromName,
  toName,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromLocationId: string
  toLocationId: string
  fromName: string
  toName: string
  onAdd: (suggestions: TransferSuggestion[]) => void
}) {
  const variations = useDataStore((s) => s.variations)
  const sales = useDataStore((s) => s.sales)
  const [months, setMonths] = useState<'3' | '6'>('3')
  const [dropped, setDropped] = useState<string[]>([])

  const suggestions = useMemo(
    () =>
      suggestTransfer({
        variations,
        sales,
        fromLocationId,
        toLocationId,
        months: Number(months),
      }),
    [variations, sales, fromLocationId, toLocationId, months],
  )

  // A different window is a different proposal, so previous exclusions no
  // longer refer to anything.
  useEffect(() => setDropped([]), [months, open])

  const chosen = suggestions.filter((s) => !dropped.includes(s.variationId))
  const units = chosen.reduce((sum, s) => sum + s.suggested, 0)

  const toggle = (id: string) =>
    setDropped((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`What ${toName} needs`}
      description={`Worked out from what ${toName} sold, and what ${fromName} can spare after covering its own sales.`}
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
              Add {formatNumber(chosen.length)} to the transfer
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
            <p className="text-fg font-medium">Nothing needs moving</p>
            <p className="text-2xs mt-1">
              Everything {toName} sells is either stocked there already, or {fromName} has none to
              spare after covering its own sales.
            </p>
          </div>
        ) : (
          <div className="border-border rounded-card max-h-96 overflow-y-auto border">
            <table className="w-full text-sm">
              <thead className="bg-canvas sticky top-0">
                <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Sold at {toName}</th>
                  <th className="px-3 py-2 text-right font-semibold">At {toName}</th>
                  <th className="px-3 py-2 text-right font-semibold">At {fromName}</th>
                  <th className="w-40 px-3 py-2 text-right font-semibold">Send</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => {
                  const on = !dropped.includes(suggestion.variationId)
                  return (
                    <tr key={suggestion.variationId} className="border-border border-t">
                      <td className="px-3 py-2">
                        <Checkbox
                          aria-label={`Include ${suggestion.name}`}
                          checked={on}
                          onCheckedChange={() => toggle(suggestion.variationId)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb src={suggestion.imageUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="text-fg truncate font-medium">{suggestion.name}</p>
                            <p className="text-fg-subtle text-2xs font-mono">{suggestion.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                        {formatNumber(suggestion.soldAtDestination)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={suggestion.stockAtDestination === 0 ? 'text-danger' : ''}>
                          {formatNumber(suggestion.stockAtDestination)}
                        </span>
                        {/* The reason the row is here, in words rather than
                            leaving somebody to divide one column by another. */}
                        <p className="text-fg-subtle text-2xs">
                          {Number.isFinite(suggestion.daysOfCover)
                            ? `${Math.round(suggestion.daysOfCover)} days left`
                            : '—'}
                        </p>
                      </td>
                      <td className="text-fg-muted px-3 py-2 text-right tabular-nums">
                        {formatNumber(suggestion.stockAtSource)}
                      </td>
                      <td className="text-fg w-40 px-3 py-2 text-right font-medium tabular-nums">
                        <span className="whitespace-nowrap">
                          {formatNumber(suggestion.suggested)} {suggestion.unit}
                        </span>
                        {suggestion.suggested < suggestion.shortfall ? (
                          // Says why it is not sending the full shortfall,
                          // rather than quietly sending less than asked.
                          <p className="text-warning text-2xs font-normal whitespace-nowrap">
                            {formatNumber(suggestion.shortfall)} needed, rest kept
                          </p>
                        ) : null}
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
