import { useEffect, useState } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { NumberField } from '@/shared/components/NumberField'
import { ProductThumb } from '@/shared/components/ProductThumb'
import { Button } from '@/shared/ui/Button'
import { formatNumber } from '@/shared/lib/format'
import type { Transfer } from '../model/transfer'

type Mode = 'send' | 'receive'

const COPY: Record<
  Mode,
  { title: string; description: string; column: string; confirm: string; shortfall: string }
> = {
  send: {
    title: 'Send this transfer',
    description:
      'Confirm what is actually going. Anything short of the order stays on the shelf it came from.',
    column: 'Sending',
    confirm: 'Send',
    shortfall: 'short of the order, and simply stays where it is',
  },
  receive: {
    title: 'Confirm receipt',
    description: 'Count what arrived. A shortfall is stock that left and never landed.',
    column: 'Arrived',
    confirm: 'Confirm receipt',
    shortfall: 'missing, and will be written off — it is on neither shelf',
  },
}

/**
 * The one dialog behind both hand-offs.
 *
 * Its reason to exist is that reality disagrees with paperwork twice on every
 * transfer: the warehouse cannot always find what was asked for, and not
 * everything that ships arrives. Both steps therefore *ask* rather than assume,
 * pre-filled with the optimistic answer so the common case is one click.
 *
 * The two shortfalls mean different things and the copy says so: what is not
 * sent stays on its shelf, while what is not received is gone.
 */
export function TransferQuantityDialog({
  open,
  onOpenChange,
  transfer,
  mode,
  availableAtSource,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer: Transfer
  mode: Mode
  /** Live stock at the source, for the send step's ceiling. */
  availableAtSource?: (variationId: string) => number
  onConfirm: (quantities: Record<string, number>) => void
}) {
  const copy = COPY[mode]

  /** The most that could move: the paperwork, capped by physical reality. */
  const ceiling = (lineId: string) => {
    const line = transfer.lines.find((l) => l.id === lineId)!
    if (mode === 'receive') return line.sentQuantity ?? 0
    // Never offer to send more than is on the shelf — the store would refuse
    // it, and refusing after the click is worse than not offering.
    const have = availableAtSource?.(line.variationId) ?? line.requestedQuantity
    return Math.min(line.requestedQuantity, have)
  }

  /** What the document asked for, which the ceiling may fall short of. */
  const ordered = (lineId: string) => {
    const line = transfer.lines.find((l) => l.id === lineId)!
    return mode === 'send' ? line.requestedQuantity : (line.sentQuantity ?? 0)
  }

  const [values, setValues] = useState<Record<string, number>>({})

  // Reset each time it opens, so a cancelled edit is not remembered as fact.
  useEffect(() => {
    if (!open) return
    setValues(Object.fromEntries(transfer.lines.map((line) => [line.id, ceiling(line.id)])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transfer.id])

  const totalExpected = transfer.lines.reduce((sum, line) => sum + ordered(line.id), 0)
  const totalActual = transfer.lines.reduce((sum, line) => sum + (values[line.id] ?? 0), 0)
  const gap = totalExpected - totalActual

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      size="lg"
      primary={{
        label: copy.confirm,
        disabled: totalActual === 0,
        onClick: () => onConfirm(values),
      }}
    >
      <div className="space-y-3">
        <div className="border-border rounded-card overflow-x-auto border">
          <table className="w-full text-sm">
            <thead className="bg-canvas">
              <tr className="text-fg-muted text-2xs tracking-wide uppercase">
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-right font-semibold">
                  {mode === 'send' ? 'Ordered' : 'Sent'}
                </th>
                {mode === 'send' ? (
                  <th className="px-3 py-2 text-right font-semibold">On the shelf</th>
                ) : null}
                <th className="px-3 py-2 text-right font-semibold">{copy.column}</th>
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((line) => {
                const want = ordered(line.id)
                const max = ceiling(line.id)
                const have = availableAtSource?.(line.variationId) ?? 0
                const value = values[line.id] ?? 0
                const short = value < max
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
                      {formatNumber(want)} {line.unit}
                    </td>
                    {mode === 'send' ? (
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          have < want ? 'text-danger' : 'text-fg-muted'
                        }`}
                      >
                        {formatNumber(have)}
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {short ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-2xs"
                            onClick={() => setValues((v) => ({ ...v, [line.id]: max }))}
                          >
                            All
                          </Button>
                        ) : null}
                        <NumberField
                          className="w-24"
                          nullable={false}
                          min={0}
                          aria-label={`${copy.column} ${line.name}`}
                          value={value}
                          onChange={(next) =>
                            setValues((v) => ({ ...v, [line.id]: Math.min(max, next ?? 0) }))
                          }
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
          <p className="text-danger text-sm">
            {formatNumber(gap)} {gap === 1 ? 'unit is' : 'units are'} {copy.shortfall}.
          </p>
        ) : (
          <p className="text-fg-subtle text-sm">
            {formatNumber(totalActual)} units, matching the {mode === 'send' ? 'order' : 'dispatch'}
            .
          </p>
        )}
      </div>
    </Modal>
  )
}
